/**
 * Checked top-level Fin sites in installed, relocated Ruby gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { copiedRubyRuntime } from "../src/backends/ruby/copied-assets.mjs";
import { renderCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { verifiedRubyAssets } from "../src/backends/ruby/verified-assets.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { reviewedScalarHostIr } from "./helpers/reviewed-scalar-host-fixture.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { nativeFinAdapterSymbol, nativeFinDispatchExpected, nativeFinDispatchSteps, nativeFinDispatchSymbols, readNativeFinDispatch } from "./helpers/native-fin-dispatch.mjs";
import { nativeFinAuditConfig, nativeFinAuditConfigSha256, nativeFinAuditDefiners, nativeFinAuditRecord, nativeFinAuditSource, readNativeFinAuditRecord } from "./helpers/native-fin-dispatch-audit.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import "./helpers/native-fin-dispatch-audit-tests.mjs";

const huge = "1180591620717411303424";
const expectedBounds = {
	"NativeFin.impossible": [["0"], null]
	, "NativeFin.only": [["1"], null]
	, "NativeFin.mirror": [["10"], "10"]
	, "NativeFin.twice": [["300"], null]
	, "NativeFin.succHuge": [[huge], huge]
	, "NativeFin.wrap": [[null], "7"]
	, "NativeFin.label": [[null, "4", null], null]
};
const bounds = refinements => refinements ? [refinements.parameters.map(item => item?.bound ?? null), refinements.result?.bound ?? null] : null;
const sharedLibraries = files => Object.fromEntries(Object.entries(files)
	.filter(([path]) => /\.so(?:\.|$)/.test(path)).map(([path, file]) => [basename(path), file.sha256 ?? file]));

/** Public API cases: exact bounds, host error identity, cleanup and recovery. */
const rubyFinConsumer = () => `require "lean_bridge/native_fin"
API = LeanBridge::NativeFin
$checks = 0
def check(value, label)
  raise "failed: #{label}" unless value
  $checks += 1
end
def rejected(parameter, bound)
  yield
  false
rescue RangeError => error
  error.message == "#{parameter} is not below its Fin #{bound} bound"
end
def raises(kind)
  yield
  false
rescue kind
  true
rescue StandardError
  false
end
huge = 1 << 70
word = 1 << 32
check(rejected("arg0", "0") { API.impossible(0) }, "Fin 0 rejects zero")
check(rejected("arg0", "0") { API.impossible(1) }, "Fin 0 rejects one")
check(API.only(0) == 7, "Fin 1 accepts zero")
check(rejected("arg0", "1") { API.only(1) }, "Fin 1 rejects its bound")
check(API.mirror(0) == 9 && API.mirror(9) == 0, "Fin 10 endpoints")
check(API.mirror(4).instance_of?(Integer) && API.mirror(4) == 5, "exact Integer results")
[10, 11, word, huge].each { |value| check(rejected("arg0", "10") { API.mirror(value) }, "Fin 10 rejects #{value}") }
check(raises(RangeError) { API.mirror(-1) } && !rejected("arg0", "10") { API.mirror(-1) }, "negative is the Nat RangeError")
[true, false, 1.0, "1", nil].each { |value| check(raises(TypeError) { API.mirror(value) }, "non-Integer is TypeError: #{value.inspect}") }
check(API.twice(299) == 598, "alias accepts its largest value")
check(rejected("arg0", "300") { API.twice(300) }, "alias rejects its bound")
check(rejected("arg0", "300") { API.twice(301) }, "alias rejects beyond its bound")
check(API.succ_huge(word) == word + 1, "large Fin crosses a limb")
check(API.succ_huge(huge - 2) == huge - 1 && API.succ_huge(huge - 1) == huge - 1, "large Fin endpoints")
[huge, huge + 1, 1 << 128].each { |value| check(rejected("arg0", huge.to_s) { API.succ_huge(value) }, "large Fin rejects #{value}") }
check(API.wrap(100) == 2 && API.wrap(huge) == 2 && API.wrap(0) == 0, "result-only Fin values")
base, name = 5, "slot".dup.freeze
check(API.label(base, 3, name) == "slot:8", "mixed arguments")
check(rejected("arg1", "4") { API.label(base, 4, name) }, "mixed arguments reject the Fin site")
check(raises(TypeError) { API.label(base, true, name) }, "mixed arguments reject true")
check(base == 5 && name == "slot" && API.label(base, 0, name) == "slot:5", "caller data unchanged")
1000.times do |i|
  raise "invalid call accepted at #{i}" unless rejected("arg0", "10") { API.mirror(10 + i) }
  raise "valid call failed at #{i}" unless API.mirror(i % 10) == 9 - i % 10
end
$checks += 2000
puts "ruby-fin-ok:#{$checks}"
`;

const rubyFinDispatchExpected = nativeFinDispatchExpected(outcome => outcome.rejected ? `rejected:${outcome.rejected[0]}<${outcome.rejected[1]}` : `ok:${outcome.ok}`);
const rubyFinDispatchRoutes = ["public Ruby methods LeanBridge::NativeFin.mirror, .impossible and .label through the verified RTLD_DEEPBIND gem loader and Fiddle into the bundled C adapter"];
const unattached = "fin dispatch audit is not attached\n", unbound = "fin dispatch audit did not bind the verified deployment\n";

/**
 * Ruby probe run under the audit. Before loading the gem it requires a fresh record from this process: the
 * expected configuration digest, this invocation's nonce and PID, an attached audit and no binding yet.
 * After loading it requires all six redirections from the configured defining libraries before printing a
 * row, so zero counts are reported only for a proven attachment. Every count comes from the mapped record.
 */
const rubyFinDispatchProbe = () => `# frozen_string_literal: true
RECORD, NONCE, CONFIG, DEFINERS = ARGV
EXPECTED = DEFINERS.to_s.split(",").map { |index| Integer(index, 10) }
LAYOUT = ${JSON.stringify(nativeFinAuditRecord.rubyFormat)}
def audit
  bytes = begin
    ::File.binread(RECORD)
  rescue ::SystemCallError, ::TypeError
    nil
  end
  bytes && bytes.bytesize == ${nativeFinAuditRecord.size} ? bytes.unpack(LAYOUT) : nil
end
def ours?(record)
  record && record[0] == ${JSON.stringify(nativeFinAuditRecord.magic)} && record[1] == ${nativeFinAuditRecord.version} && record[2] == 6 && record[3] == CONFIG && record[4] == NONCE && record[5] == ::Process.pid && record[6] == 1
end
def entries(record) = record[28, 6]
record = ARGV.size == 4 && EXPECTED.size == 6 ? audit : nil
unless ours?(record) && record[7].zero? && record[8].zero? && record[9].zero? && entries(record).all?(&:zero?)
  $stderr.write(${JSON.stringify(unattached)})
  exit 2
end
require "lean_bridge/native_fin"
API = LeanBridge::NativeFin
record = audit
unless ours?(record) && record[7] == 0x3f && record[8].zero? && record[9].zero? && record[10, 6].all?(&:positive?) && record[16, 6] == EXPECTED && record[22, 6].all?(&:positive?) && entries(record).all?(&:zero?)
  $stderr.write(${JSON.stringify(unbound)})
  exit 3
end
def report(step, status)
  $stdout.write([step, status, *entries(audit)].join(" ") + "\\n")
end
def status
  value = yield
  value.instance_of?(Integer) || (value.instance_of?(String) && value.match?(/\\A[!-~]+\\z/)) ? "ok:#{value}" : "ok:unexpected"
rescue ::RangeError => error
  match = /\\A(arg[0-9]+) is not below its Fin ([0-9]+) bound\\z/.match(error.message)
  match ? "rejected:#{match[1]}<#{match[2]}" : "error:RangeError"
rescue ::StandardError => error
  "error:#{error.class}"
end
report("start", "ok")
${nativeFinDispatchSteps.slice(1).map(([step, name, args]) => `report(${JSON.stringify(step)}, status { API.${name}(${args.map(value => typeof value === "string" ? JSON.stringify(value) : value.toString()).join(", ")}) })`).join("\n")}
`;

/**
 * Build the audit for the verified deployment directory and count per-step entries in one Ruby process.
 * Library bytes are verified against the gem receipt and every counted symbol's single defining library is
 * read from nm before anything runs; a run without the audit must refuse before loading the gem.
 *
 * @param root0 - Verified deployment and the Ruby command that loads it.
 * @param root0.probeRoot - Task-owned directory for the audit, probe and records.
 * @param root0.nativeDirectory - Directory that holds the verified libraries the gem loads.
 * @param root0.componentId - Component identity that names the counted adapters.
 * @param root0.command - Ruby executable.
 * @param root0.args - Ruby arguments that precede the probe path.
 * @param root0.cwd - Working directory for Ruby.
 * @param root0.env - Clean environment that finds the gem.
 * @param root0.audit - Optional configuration override, for refusal controls.
 */
const observeRubyDispatch = async ({ probeRoot, nativeDirectory, componentId, command, args = [], cwd, env, audit = null }) => {
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const libraries = (await readdir(nativeDirectory)).filter(name => /\.so(?:\.[0-9]+)*$/u.test(name)).sort();
	const listings = {};
	for(const name of libraries) listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(nativeDirectory, name)], nativeDirectory, tools)).stdout;
	const config = nativeFinAuditConfig({ componentId, libraries, definers: nativeFinAuditDefiners(componentId, listings), ...audit });
	const source = nativeFinAuditSource(config), configSha256 = nativeFinAuditConfigSha256(config);
	await saveLakeFile(probeRoot, "audit.c", source);
	await saveLakeFile(probeRoot, "dispatch.rb", rubyFinDispatchProbe());
	await runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-shared", "-fPIC", "audit.c", "-o", "libfinaudit.so"], probeRoot, tools);
	const exported = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(probeRoot, "libfinaudit.so")], probeRoot, tools)).stdout;
	assert.deepEqual(exported.trim().split("\n").map(line => line.split(" ").slice(1).join(" ")).sort(), ["T la_objopen", "T la_symbind64", "T la_version"]);
	const definers = config.definers.map(name => config.libraries.indexOf(name)).join(",");
	let runs = 0;
	// The result is left pending so callers can assert refusals; before() may plant a file at the record path first.
	const run = async (extra, { nonce = randomBytes(16).toString("hex"), before = null } = {}) => {
		const record = join(probeRoot, `record-${runs++}.bin`);
		if(before) await before(record);
		const probeArgs = [...args, join(probeRoot, "dispatch.rb"), record, nonce, configSha256, definers];
		const probeEnv = { ...env, LEAN_BRIDGE_FIN_AUDIT_RECORD: record, LEAN_BRIDGE_FIN_AUDIT_NONCE: nonce, LEAN_BRIDGE_FIN_AUDIT_ROOT: nativeDirectory, ...extra };
		return { record, nonce, result: runCopied(command, probeArgs, cwd, probeEnv) };
	};
	const audited = { LD_AUDIT: join(probeRoot, "libfinaudit.so") };
	return { config, configSha256, source, definers, run, audited, auditSha256: sha256(await readFile(join(probeRoot, "libfinaudit.so"))) };
};

/**
 * Require the mapped record of one accepted run to match its rows and configuration exactly.
 *
 * @param observer - Result of observeRubyDispatch.
 * @param root0 - One run.
 * @param root0.record - Record path.
 * @param root0.nonce - This run's nonce.
 * @param observed - Parsed rows of the same run.
 */
const assertRubyDispatchRecord = async (observer, { record, nonce }, observed) => {
	const mapped = readNativeFinAuditRecord(await readFile(record)), { config } = observer;
	assert.deepEqual([mapped.magic, mapped.version, mapped.columns, mapped.config, mapped.nonce, mapped.attached], [nativeFinAuditRecord.magic, 1, 6, observer.configSha256, nonce, 1]);
	assert.deepEqual([mapped.redirected, mapped.conflicts, mapped.foreign], [0x3f, 0, 0]);
	assert.deepEqual(mapped.definers, config.definers.map(name => config.libraries.indexOf(name)));
	assert.ok(mapped.bindings.every(count => count >= 1) && mapped.callers.every(mask => mask > 0));
	// The entries the probe printed last are the mapped bytes after the final call.
	assert.deepEqual(mapped.entries, observed.at(-1)[2]);
	return { bindings: mapped.bindings, callers: mapped.callers.map(mask => config.libraries.filter((_, index) => mask & 1 << index)) };
};

const standInEvidence = libraries => ({ runtimeIdentity: sha256("ruby fin dispatch stand-in"), componentId: "native-fin@1.0.0", library: "libnative_fin.so", libraries });
/**
 * A stand-in gem entry that loads through the real generated verified loader with its production flags.
 *
 * @param libraries - Basename to SHA-256 of each stand-in library.
 */
const standInGem = libraries => `# frozen_string_literal: true
require "digest"
require "digest/sha2"
require "fiddle"
module LeanBridge
  module NativeFin
${verifiedRubyAssets(standInEvidence(libraries))}
      WORD, POINTER, STATUS = ::Fiddle::TYPE_UINTPTR_T, ::Fiddle::TYPE_VOIDP, ::Fiddle::TYPE_INT
      MIRROR = ::Fiddle::Function.new(LIBRARY["native_fin_mirror"], [WORD, POINTER, POINTER], STATUS)
      IMPOSSIBLE = ::Fiddle::Function.new(LIBRARY["native_fin_impossible"], [WORD, POINTER, POINTER], STATUS)
      LABEL = ::Fiddle::Function.new(LIBRARY["native_fin_label"], [WORD, WORD, POINTER, POINTER, POINTER], STATUS)
      def self.word(value) = value.bit_length > 64 ? (1 << 64) - 1 : value
      def self.invoke(function, *args)
        output = ::Fiddle::Pointer.malloc(64, ::Fiddle::RUBY_FREE)
        error = ::Fiddle::Pointer.malloc(64, ::Fiddle::RUBY_FREE)
        raise ::RangeError, error.to_s unless function.call(*args, output, error).zero?
        output
      end
      def self.mirror(arg0) = invoke(MIRROR, word(arg0))[0, 8].unpack1("Q<")
      def self.impossible(arg0) = invoke(IMPOSSIBLE, word(arg0))[0, 8].unpack1("Q<")
      def self.label(arg0, arg1, arg2) = invoke(LABEL, word(arg0), word(arg1), arg2).to_s
  end
end
`;
const adapter = name => nativeFinAdapterSymbol("native-fin@1.0.0", `NativeFin.${name}`);
/** Stand-in Lean sources and their exported adapters, one library as in the component build. */
const standInComponent = () => `#include <stdint.h>
void *l_NativeFin_mirror(void *a0) { return (void *)(9 - (uintptr_t)a0); }
void *l_NativeFin_impossible(void *a0) { return a0; }
void *l_NativeFin_label(void *a0, void *a1, void *a2) { (void)a2; return (void *)((uintptr_t)a0 + (uintptr_t)a1); }
void *${adapter("mirror")}(void *a0) { return l_NativeFin_mirror(a0); }
void *${adapter("impossible")}(void *a0) { return l_NativeFin_impossible(a0); }
void *${adapter("label")}(void *a0, void *a1, void *a2) { return l_NativeFin_label(a0, a1, a2); }
`;
/** The checked C entry points: each bound is checked before its adapter, unless LEAK is defined. */
const standInAdapter = () => `#include <stdint.h>
#include <stdio.h>
void *${adapter("mirror")}(void *);
void *${adapter("impossible")}(void *);
void *${adapter("label")}(void *, void *, void *);
static volatile uintptr_t fin0 = 0, fin4 = 4, fin10 = 10;
static int reject(char *error, const char *message) { snprintf(error, 64, "%s", message); return 1; }
int native_fin_mirror(uintptr_t arg0, uintptr_t *out, char *error) {
#ifdef LEAK
  if (arg0 >= fin10) (void)${adapter("mirror")}((void *)arg0);
#endif
  if (arg0 >= fin10) return reject(error, "arg0 is not below its Fin 10 bound");
  *out = (uintptr_t)${adapter("mirror")}((void *)arg0); return 0;
}
int native_fin_impossible(uintptr_t arg0, uintptr_t *out, char *error) {
  if (arg0 >= fin0) return reject(error, "arg0 is not below its Fin 0 bound");
  *out = (uintptr_t)${adapter("impossible")}((void *)arg0); return 0;
}
int native_fin_label(uintptr_t arg0, uintptr_t arg1, const char *arg2, char *out, char *error) {
  if (arg1 >= fin4) return reject(error, "arg1 is not below its Fin 4 bound");
  snprintf(out, 64, "%s:%lu", arg2, (unsigned long)(uintptr_t)${adapter("label")}((void *)arg0, (void *)arg1, (void *)arg2)); return 0;
}
`;

test("Ruby gems are checked Fin consumers beside C, C++, Python and Rust", () => {
	for(const targets of [["rubygems"], ["c", "rubygems"], ["c", "cpp", "pypi", "cargo", "rubygems"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	assert.equal(supportsNativeRefinementTargets(["rubygems", "cpan"]), true);
});

test("generated Ruby bound docs come only from checked refinement metadata", () => {
	const ir = corpusReviewedIr({ id: "fins" }, [
		{ name: "Fins.label", parameters: ["nat", "nat", "string"], result: "string" }
		, { name: "Fins.plain", parameters: ["nat"], result: "nat" }]);
	const label = ir.declarations.find(item => item.id === "lean:Fins.label");
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "fin", bound: "4" }, null], result: null };
	const files = renderCopiedRubyPackage(compileCopiedRubyModel(ir));
	assert.match(files["lib/lean_bridge/fins.rb"], / {4}# Checked Lean Fin bounds: arg1 < 4\.\n {4}def label\(arg0, arg1, arg2\)/);
	assert.doesNotMatch(files["lib/lean_bridge/fins.rb"], /bounds: [^\n]*\n {4}def plain/);
	assert.match(files["README.md"], /Lean Fin n parameters and results are exact Integer values below n\./);
	assert.match(files["README.md"], /\n- LeanBridge::Fins\.label: arg1 < 4\n/);
	// A top-level Subtype documents its checked constructor; one inside a container is refused.
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	const checked = renderCopiedRubyPackage(compileCopiedRubyModel(ir));
	assert.match(checked["README.md"], /arg1 checked by Fins\.check/);
	assert.match(checked["README.md"], /Lean Subtype parameters cross as their base value\./);
	assert.doesNotMatch(checked["README.md"], /Lean Fin n parameters/);
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "array", arguments: [{ kind: "subtype", constructor: "Fins.check" }] }, null], result: null };
	assert.throws(() => renderCopiedRubyPackage(compileCopiedRubyModel(ir)), TypeError);
});

const standInRuby = resolve(".toolchains/ruby33/bin/ruby");
test("the Ruby dispatch audit counts a deep-bound stand-in exactly and refuses missing, stale, foreign and leaking runs", { skip: !existsSync(standInRuby) || process.platform !== "linux" || process.arch !== "x64" }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-fin-audit-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }, componentId = "native-fin@1.0.0";
	const cc = args => runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-shared", "-fPIC", "-Wl,-z,now", ...args], root, tools);
	await saveLakeFile(root, "src/component.c", standInComponent());
	await saveLakeFile(root, "src/adapter.c", standInAdapter());
	await saveLakeFile(root, "src/runtime.c", "int lean_bridge_stand_in_runtime(void) { return 0; }\n");
	const gems = {};
	for(const [variant, flags] of [["gem", []], ["leaking", ["-DLEAK"]]])
	{
		const lib = join(root, variant, "lib"), native = join(lib, "lean_bridge/native/linux-x64");
		await saveLakeFile(native, ".keep", "");
		await cc([join(root, "src/runtime.c"), "-o", join(native, "libleanshared.so")]);
		await cc([join(root, "src/runtime.c"), "-o", join(native, "liblean_bridge_native.so")]);
		await cc([join(root, "src/component.c"), "-o", join(native, "libcomponent_stand_in.so")]);
		await cc([...flags, join(root, "src/adapter.c"), "-L", native, "-l:libcomponent_stand_in.so", "-Wl,-rpath,$ORIGIN", "-o", join(native, "libnative_fin.so")]);
		await rm(join(native, ".keep"));
		const libraries = Object.fromEntries(await Promise.all((await readdir(native)).sort().map(async name => [name, sha256(await readFile(join(native, name)))])));
		await saveLakeFile(lib, "lean_bridge/native_fin.rb", standInGem(libraries));
		await saveLakeFile(lib, "lean_bridge/native_copied_runtime_v1.rb", copiedRubyRuntime);
		gems[variant] = { lib, native };
	}
	const observe = (variant, probe, audit = null) => observeRubyDispatch({
		probeRoot: join(root, probe)
		, nativeDirectory: gems[variant].native
		, componentId
		, command: standInRuby
		, args: ["-I", gems[variant].lib]
		, cwd: root
		, env: copiedCleanEnvironment
		, audit
	});
	const observer = await observe("gem", "probe");
	assert.deepEqual(observer.config.definers, Array(6).fill("libcomponent_stand_in.so"));
	const refused = async (attempt, code, stderr) => assert.rejects(attempt.result, error => error.message.includes(`exited with status ${code}`)
		&& error.details.stdout === "" && error.details.stderr === stderr);
	// Without the audit no record exists, and the probe refuses before loading the gem.
	const missing = await observer.run({});
	await refused(missing, 2, unattached);
	assert.equal(existsSync(missing.record), false);
	// Under the production deep-bound flags every row is exact, and the mapped record agrees with it.
	const accepted = await observer.run(observer.audited);
	const { stdout, stderr } = await accepted.result;
	assert.equal(stderr, "");
	const observed = readNativeFinDispatch(stdout, rubyFinDispatchExpected);
	assert.deepEqual(observed, rubyFinDispatchExpected);
	const mapped = await assertRubyDispatchRecord(observer, accepted, observed);
	assert.deepEqual(mapped.callers, [...Array(3).fill(["libcomponent_stand_in.so"]), ...Array(3).fill(["libnative_fin.so"])]);
	// A stale valid record is never adopted, with a fresh nonce or with its own nonce replayed.
	const stale = await readFile(accepted.record);
	for(const nonce of [undefined, accepted.nonce])
	{
		const attempt = await observer.run(observer.audited, { nonce, before: path => writeFile(path, stale, { flag: "wx" }) });
		await refused(attempt, 2, unattached);
		assert.ok((await readFile(attempt.record)).equals(stale), "the stale record is untouched");
	}
	// An audit rooted elsewhere binds nothing of the loaded gem.
	await refused(await observer.run({ ...observer.audited, LEAN_BRIDGE_FIN_AUDIT_ROOT: gems.leaking.native }), 3, unbound);
	// Adapters configured in the wrong library are reported as foreign and left uncounted.
	const wrong = await observe("gem", "wrong", { definers: Object.fromEntries(nativeFinDispatchSymbols(componentId).map((symbol, k) => [symbol, k < 3 ? "libcomponent_stand_in.so" : "libnative_fin.so"])) });
	const misplaced = await wrong.run(wrong.audited);
	await refused(misplaced, 3, unbound);
	const partial = readNativeFinAuditRecord(await readFile(misplaced.record));
	assert.equal(partial.redirected, 0b000111); assert.ok(partial.foreign >= 3);
	// A C entry point that enters its adapter before rejecting is caught at its first invalid row.
	const leaking = await observe("leaking", "leak");
	const leak = await (await leaking.run(leaking.audited)).result;
	assert.match(leak.stdout, /^invalid-mirror-bound rejected:arg0<10 1 0 0 1 0 0$/mu);
	assert.throws(() => readNativeFinDispatch(leak.stdout, rubyFinDispatchExpected), /invalid-mirror-bound was rejected but changed counts by 1 0 0 1 0 0/u);
});

const checkInstalledRubyFin = async (t, reviewed = false) => {
	const environment = nativeFixtureEnvironment(["c", "ruby"]);
	environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
	environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	const reports = [], archives = [];
	for(const attempt of [0, 1])
	{
		const author = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-fin-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-fin-consumer-"));
		t.after(() => Promise.all([author, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(author, "project"), outputRoot = join(author, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/native-fin", projectRoot, { recursive: true });
		const reviewedSource = reviewed ? canonicalJson(reviewedScalarHostIr()) : null;
		if(reviewed) await saveLakeFile(projectRoot, "api.binding-ir.json", reviewedSource);
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, rubygems: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Ruby gem`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "rubygems"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
		if(reviewed)
		{
			assert.equal(model.sourceIdentity.reviewedBindingIr.source, reviewedSource);
			assert.equal(model.sourceIdentity.reviewedBindingIr.sourceSha256, sha256(reviewedSource));
		}
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		await rm(author, { recursive: true, force: true });
		if(attempt === 1) break;
		const cPackage = receipt.packages.find(pkg => pkg.target === "c" && pkg.role === "component");
		const extracted = join(consumer, "c-extract");
		await saveLakeFile(extracted, ".keep", "");
		await runCopied("/usr/bin/tar", ["--use-compress-program=/usr/bin/gzip", "-xf", join(handoff, cPackage.artifacts[0].path)], extracted);
		const cInstalled = join(extracted, `${cPackage.name}-${cPackage.version}-c`);
		const cReceipt = JSON.parse(await readFile(join(cInstalled, "lean-bridge-package.json"), "utf8"));
		await verifyNativeFiles(cInstalled, cReceipt.files);
		const cLibraries = sharedLibraries(cReceipt.files);
		t.diagnostic("offline gem installation without producer files or compilers");
		const packages = receipt.packages.filter(pkg => pkg.target === "rubygems");
		const fixture = { source: rubyFinConsumer, success: "ruby-fin-ok" };
		const { command, ...observation } = await installCopiedConsumer({ profile: "ruby", consumer, handoff, packages, environment, fixture });
		const root = join(consumer, "ruby"), gems = join(root, "gems");
		const env = { ...copiedCleanEnvironment, GEM_HOME: gems, GEM_PATH: gems };
		const installed = (await runCopied(command, ["-e", 'print Gem::Specification.find_by_name("native-fin", "1.0.0").full_gem_path'], root, env)).stdout;
		const gemReceipt = JSON.parse(await readFile(join(installed, "lean-bridge/package-receipt.json"), "utf8"));
		await verifyNativeFiles(installed, gemReceipt.files);
		const gemLibraries = sharedLibraries(gemReceipt.files);
		// The gem bundles the exact checked adapter that the C, Python and Rust probes
		// instrument; its RTLD_DEEPBIND loader bypasses LD_PRELOAD, so entries are counted under LD_AUDIT.
		const shared = Object.keys(gemLibraries).filter(name => Object.hasOwn(cLibraries, name)).sort();
		assert.ok(shared.includes("libnative_fin.so"), JSON.stringify({ gem: gemLibraries, c: cLibraries }));
		for(const name of shared) assert.equal(gemLibraries[name], cLibraries[name], name);
		const docs = await readFile(join(installed, "lib/lean_bridge/native_fin.rb"), "utf8");
		assert.match(docs, / {4}# Checked Lean Fin bounds: arg0 < 10; result < 10\.\n {4}def mirror\(arg0\)/);
		assert.match(docs, / {4}# Checked Lean Fin bounds: arg1 < 4\.\n {4}def label\(arg0, arg1, arg2\)/);
		const relocated = join(consumer, "ruby-relocated");
		await rename(root, relocated);
		const movedGems = join(relocated, "gems");
		const repeated = await runCopied(command, ["consumer.rb"], relocated, { ...copiedCleanEnvironment, GEM_HOME: movedGems, GEM_PATH: movedGems });
		assert.equal(repeated.stderr, ""); assert.equal(repeated.stdout.trim(), `ruby-fin-ok:${observation.checks}`);
		// The counted adapters are the model's own exports for this component identity.
		assert.equal(model.component.id, "native-fin@1.0.0");
		for(const name of ["mirror", "impossible", "label"])
			assert.equal(model.exports.find(item => item.name === `NativeFin.${name}`).symbol, nativeFinAdapterSymbol(model.component.id, `NativeFin.${name}`), name);
		t.diagnostic("per-step source and adapter counts in the relocated Ruby process under LD_AUDIT");
		const relocatedGem = join(relocated, relative(root, installed));
		await verifyNativeFiles(relocatedGem, gemReceipt.files);
		const directories = [...new Set(Object.keys(gemReceipt.files).filter(path => /\.so(?:\.[0-9]+)*$/u.test(path)).map(dirname))];
		assert.equal(directories.length, 1, directories.join(","));
		const observer = await observeRubyDispatch({
			probeRoot: join(consumer, "dispatch")
			, nativeDirectory: join(relocatedGem, directories[0])
			, componentId: model.component.id
			, command
			, cwd: relocated
			, env: { ...copiedCleanEnvironment, GEM_HOME: movedGems, GEM_PATH: movedGems }
		});
		// Without the audit the probe refuses before loading the gem, and no record appears.
		const missing = await observer.run({});
		await assert.rejects(missing.result, error => /exited with status 2/.test(error.message)
			&& error.details.stdout === "" && error.details.stderr === unattached);
		assert.equal(existsSync(missing.record), false);
		const accepted = await observer.run(observer.audited);
		const counted = await accepted.result;
		assert.equal(counted.stderr, "");
		const observed = readNativeFinDispatch(counted.stdout, rubyFinDispatchExpected);
		assert.deepEqual(observed, rubyFinDispatchExpected);
		const mapped = await assertRubyDispatchRecord(observer, accepted, observed);
		const dispatch = {
			columns: observer.config.columns
			, observed
			, interposer: "LD_AUDIT"
			, routes: rubyFinDispatchRoutes
			, positiveControl: "valid public Ruby calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column"
			, probeSha256: sha256(rubyFinDispatchProbe())
			, auditSourceSha256: sha256(observer.source)
			, auditSha256: observer.auditSha256
			, configSha256: observer.configSha256
			, definers: observer.config.definers
			, bindings: mapped.bindings
			, callers: mapped.callers
		};
		reports.push({ profile: "ruby"
			, path: reviewed ? "reviewed-ir" : "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, gemLibraries[name]]))
			, dispatch
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, ...(reviewed ? { reviewedSourceSha256: model.sourceIdentity.reviewedBindingIr.sourceSha256 } : {})
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true
			, installedFilesSha256: sha256(canonicalJson(gemReceipt.files)) });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", reviewed ? "ruby-reviewed.json" : "ruby.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
};

test("relocated source-free Ruby gems check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_RUBY_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledRubyFin(t));

test("independently reviewed Ruby packages check scalar Fin through installed consumers", { skip: process.env.LEAN_BRIDGE_RUBY_FIN_TEST !== "1", timeout: 2_400_000 }, t => checkInstalledRubyFin(t, true));
