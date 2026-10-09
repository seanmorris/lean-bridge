/**
 * Checked top-level Fin sites in installed, relocated Ruby gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises";
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
import { nativeFinDefiners, nativeFinGdbExit, nativeFinGdbIdentity, nativeFinGdbRecord, nativeFinGdbScript, readNativeFinGdbRecord } from "./helpers/native-fin-dispatch-gdb.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";
import "./helpers/native-fin-dispatch-gdb-tests.mjs";

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
const unattached = "fin dispatch instrumentation is not attached\n", uncovered = "fin dispatch instrumentation did not cover the verified deployment\n";
const gdbCommand = process.env.LEAN_BRIDGE_GDB ?? "/usr/bin/gdb";

/**
 * Ruby probe run under GDB. Before loading the gem it requires a fresh record for this process: the
 * expected identity digest, this invocation's nonce and PID, an attached debugger and nothing armed. After
 * loading it requires a breakpoint on every one of the six verified definitions, including entries that no
 * relocation references, before printing a row; every count comes from the record GDB updates on each hit.
 * The optional dynamic mode adds one owned stand-in step that calls an otherwise unreferenced adapter.
 */
const rubyFinDispatchProbe = () => `# frozen_string_literal: true
RECORD, NONCE, CONFIG, DEFINERS, MODE = ARGV
EXPECTED = DEFINERS.to_s.split(",").map { |index| Integer(index, 10) }
LAYOUT = ${JSON.stringify(nativeFinGdbRecord.rubyFormat)}
def instrumentation
  bytes = begin
    ::File.binread(RECORD)
  rescue ::SystemCallError, ::TypeError
    nil
  end
  bytes && bytes.bytesize == ${nativeFinGdbRecord.size} ? bytes.unpack(LAYOUT) : nil
end
def ours?(record)
  record && record[0] == ${JSON.stringify(nativeFinGdbRecord.magic)} && record[1] == ${nativeFinGdbRecord.version} && record[2] == 6 && record[3] == CONFIG && record[4] == NONCE && record[5] == ::Process.pid && record[6] == 1
end
def entries(record) = record[28, 6]
record = [4, 5].include?(ARGV.size) && EXPECTED.size == 6 ? instrumentation : nil
unless ours?(record) && record[7].zero? && record[8].zero? && record[9].zero? && entries(record).all?(&:zero?)
  $stderr.write(${JSON.stringify(unattached)})
  exit 2
end
require "lean_bridge/native_fin"
API = LeanBridge::NativeFin
record = instrumentation
unless ours?(record) && record[7] == 0x3f && record[8].zero? && record[9].zero? && record[10, 6].all? { |count| count == 1 } && record[16, 6] == EXPECTED && entries(record).all?(&:zero?)
  $stderr.write(${JSON.stringify(uncovered)})
  exit 3
end
def report(step, status)
  $stdout.write([step, status, *entries(instrumentation)].join(" ") + "\\n")
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
report("dynamic-impossible-adapter", status { API.dynamic_impossible_adapter }) if MODE == "dynamic"
`;

/**
 * Prepare GDB instrumentation of one verified deployment directory and run the probe with or without it.
 * Every counted symbol's single defining library is read from nm before anything runs; each run gets a new
 * nonce, record, breakpoint list and output files. Results carry the probe's own exit status, stdout and
 * stderr; GDB's statuses 70-72 mean the inferior never produced trusted rows.
 *
 * @param root0 - Verified deployment and the Ruby command that loads it.
 * @param root0.probeRoot - Task-owned directory for the script, probe and records.
 * @param root0.nativeDirectory - Directory that holds the verified libraries the gem loads.
 * @param root0.componentId - Component identity that names the counted adapters.
 * @param root0.command - Ruby executable.
 * @param root0.args - Ruby arguments that precede the probe path.
 * @param root0.cwd - Working directory for Ruby.
 * @param root0.env - Clean environment that finds the gem.
 * @param root0.definers - Optional per-column definer override, for refusal controls.
 */
const observeRubyDispatch = async ({ probeRoot, nativeDirectory, componentId, command, args = [], cwd, env, definers = null }) => {
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" };
	const libraries = (await readdir(nativeDirectory)).filter(name => /\.so(?:\.[0-9]+)*$/u.test(name)).sort();
	const listings = {};
	for(const name of libraries) listings[name] = (await runCopied("/usr/bin/nm", ["-D", "--defined-only", join(nativeDirectory, name)], nativeDirectory, tools)).stdout;
	const { identity, configSha256, definerIndices } = nativeFinGdbIdentity({ componentId, libraries, definers: definers ?? nativeFinDefiners(componentId, listings) });
	await saveLakeFile(probeRoot, "dispatch.rb", rubyFinDispatchProbe());
	await saveLakeFile(probeRoot, "fin.gdb.py", nativeFinGdbScript);
	let runs = 0;
	/**
	 * One probe run; before() may plant a file at the record path first.
	 *
	 * @param root0 - Run options.
	 * @param root0.gdb - Run under GDB instrumentation.
	 * @param root0.mode - Optional probe mode.
	 * @param root0.root - Directory GDB treats as verified, normally the native directory.
	 * @param root0.nonce - Run nonce; fresh unless replayed by a control.
	 * @param root0.before - Optional hook given the record path.
	 * @param root0.inject - Test-only GDB failure injection, never used by acceptance runs.
	 */
	const run = async ({ gdb = true, mode = null, root = nativeDirectory, nonce = randomBytes(16).toString("hex"), before = null, inject = null } = {}) => {
		const stem = join(probeRoot, `run-${runs++}`), record = `${stem}.record`, armed = `${stem}.armed.json`;
		if(before) await before(record);
		const argv = [command, ...args, join(probeRoot, "dispatch.rb"), record, nonce, configSha256, definerIndices.join(","), ...mode ? [mode] : []];
		const config = { identity, configSha256, root, nonce, record, armed, argv, stdout: `${stem}.stdout`, stderr: `${stem}.stderr`, ...inject ? { inject } : {} };
		await writeFile(`${stem}.json`, canonicalJson(config), { flag: "wx" });
		const started = gdb
			? runCopied(gdbCommand, ["-batch", "-q", "-nx", "-x", join(probeRoot, "fin.gdb.py")], cwd, { ...env, LEAN_BRIDGE_FIN_GDB_CONFIG: `${stem}.json` })
			: runCopied(argv[0], argv.slice(1), cwd, env);
		let code = 0, stdout, stderr;
		try
		{ ({ stdout, stderr } = await started); }
		catch(error)
		{
			const status = /exited with status (\d+)/u.exec(error.message);
			if(!status) throw error;
			code = Number(status[1]); ({ stdout, stderr } = error.details);
		}
		const read = async path => (existsSync(path) ? readFile(path, "utf8") : null);
		// Under GDB the process streams carry GDB's own messages; the probe's streams are files.
		if(!gdb) return { record, nonce, armed, code, output: stdout + stderr, stdout, stderr };
		return { record, nonce, armed, code, output: stdout + stderr, stdout: await read(config.stdout), stderr: await read(config.stderr) };
	};
	return { identity, configSha256, definerIndices, listings, run };
};

/**
 * Require one accepted run's record and armed breakpoints to match its rows and verified definitions.
 *
 * @param observer - Result of observeRubyDispatch.
 * @param root0 - One run.
 * @param root0.record - Record path.
 * @param root0.nonce - This run's nonce.
 * @param root0.armed - Armed breakpoint list path.
 * @param observed - Parsed rows of the same run.
 */
const assertRubyDispatchRecord = async (observer, { record, nonce, armed }, observed) => {
	const mapped = readNativeFinGdbRecord(await readFile(record)), { identity } = observer;
	assert.deepEqual([mapped.magic, mapped.version, mapped.columns, mapped.config, mapped.nonce, mapped.attached], [nativeFinGdbRecord.magic, 1, 6, observer.configSha256, nonce, 1]);
	assert.deepEqual([mapped.armed, mapped.conflicts, mapped.foreign, mapped.breakpoints], [0x3f, 0, 0, [1, 1, 1, 1, 1, 1]]);
	assert.deepEqual(mapped.definers, observer.definerIndices);
	// The entries the probe printed last are the record's bytes after the final call.
	assert.deepEqual(mapped.entries, observed.at(-1)[2]);
	// GDB kept the inferior PID, configuration and nonce outside the record when it armed.
	const manifest = JSON.parse(await readFile(armed, "utf8"));
	assert.deepEqual([manifest.configSha256, manifest.nonce], [observer.configSha256, nonce]);
	assert.ok(Number.isSafeInteger(manifest.pid) && manifest.pid > 0);
	assert.equal(mapped.pid, manifest.pid, "the record belongs to the instrumented inferior");
	// Each breakpoint sits exactly on its symbol's nm definition in the configured library.
	const breakpoints = manifest.breakpoints.map(({ symbol, library, offset }) => ({ symbol, library, offset }));
	assert.deepEqual(breakpoints.map(item => [item.symbol, item.library]), identity.columns.map((symbol, k) => [symbol, identity.definers[k]]));
	for(const { symbol, library, offset } of breakpoints)
	{
		const line = observer.listings[library].split("\n").find(entry => entry.trim().endsWith(` ${symbol}`));
		assert.equal(offset, Number.parseInt(line.trim().split(" ")[0], 16), symbol);
	}
	return breakpoints.map(({ symbol, library, offset }) => ({ symbol, library, offset: `0x${offset.toString(16)}` }));
};

const standInEvidence = libraries => ({ runtimeIdentity: sha256("ruby fin dispatch stand-in"), componentId: "native-fin@1.0.0", library: "libnative_fin.so", libraries });
const adapter = name => nativeFinAdapterSymbol("native-fin@1.0.0", `NativeFin.${name}`);
/**
 * A stand-in gem entry that loads through the real generated verified loader with its production flags.
 * The extra dynamic method reaches the otherwise unreferenced Fin 0 adapter by symbol lookup.
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
      def self.dynamic_impossible_adapter = ::Fiddle::Function.new(LIBRARY[${JSON.stringify(adapter("impossible"))}], [POINTER], POINTER).call(0).to_i
  end
end
`;
/** Stand-in Lean sources and their exported adapters, one library as in the component build. */
const standInComponent = () => `#include <stdint.h>
void *l_NativeFin_mirror(void *a0) { return (void *)(9 - (uintptr_t)a0); }
void *l_NativeFin_impossible(void *a0) { return a0; }
void *l_NativeFin_label(void *a0, void *a1, void *a2) { (void)a2; return (void *)((uintptr_t)a0 + (uintptr_t)a1); }
void *${adapter("mirror")}(void *a0) { return l_NativeFin_mirror(a0); }
void *${adapter("impossible")}(void *a0) { return l_NativeFin_impossible(a0); }
void *${adapter("label")}(void *a0, void *a1, void *a2) { return l_NativeFin_label(a0, a1, a2); }
`;
/**
 * The checked C entry points in the generated layout: each bound is checked before its adapter, and the
 * Fin 0 entry rejects without referencing its adapter at all. LEAK enters the mirror adapter first.
 */
const standInAdapter = () => `#include <stdint.h>
#include <stdio.h>
void *${adapter("mirror")}(void *);
void *${adapter("label")}(void *, void *, void *);
static volatile uintptr_t fin4 = 4, fin10 = 10;
static int reject(char *error, const char *message) { snprintf(error, 64, "%s", message); return 1; }
int native_fin_mirror(uintptr_t arg0, uintptr_t *out, char *error) {
#ifdef LEAK
  if (arg0 >= fin10) (void)${adapter("mirror")}((void *)arg0);
#endif
  if (arg0 >= fin10) return reject(error, "arg0 is not below its Fin 10 bound");
  *out = (uintptr_t)${adapter("mirror")}((void *)arg0); return 0;
}
int native_fin_impossible(uintptr_t arg0, uintptr_t *out, char *error) { (void)arg0; (void)out; return reject(error, "arg0 is not below its Fin 0 bound"); }
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
const standInSkip = !existsSync(standInRuby) ? "the pinned Ruby 3.3 toolchain is not installed"
	: process.platform !== "linux" || process.arch !== "x64" ? "GDB entry counters target x86_64 Linux"
		: !existsSync(gdbCommand) ? `no debugger at ${gdbCommand}; entry-breakpoint controls need GDB with ptrace` : false;
test("GDB entry breakpoints count a deep-bound Ruby stand-in exactly and refuse missing, stale, foreign and leaking runs", { skip: standInSkip }, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-ruby-fin-gdb-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const tools = { ...copiedCleanEnvironment, PATH: "/usr/bin:/bin" }, componentId = "native-fin@1.0.0";
	const cc = args => runCopied("/usr/bin/cc", ["-std=c11", "-Wall", "-Wextra", "-Werror", "-O2", "-shared", "-fPIC", ...args], root, tools);
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
	// As generated, nothing in the deployment references the Fin 0 adapter.
	const relocations = (await runCopied("/usr/bin/readelf", ["-rW", join(gems.gem.native, "libnative_fin.so")], root, tools)).stdout;
	assert.ok(relocations.includes(adapter("mirror")) && !relocations.includes(adapter("impossible")));
	const observe = (variant, probe, definers = null) => observeRubyDispatch({
		probeRoot: join(root, probe)
		, nativeDirectory: gems[variant].native
		, componentId
		, command: standInRuby
		, args: ["-I", gems[variant].lib]
		, cwd: root
		, env: copiedCleanEnvironment
		, definers
	});
	const observer = await observe("gem", "probe");
	assert.deepEqual(observer.identity.definers, Array(6).fill("libcomponent_stand_in.so"));
	const refused = (run, code, stderr) => {
		assert.equal(run.code, code, run.output);
		assert.equal(run.stdout ?? "", ""); if(stderr !== null) assert.equal(run.stderr, stderr);
	};
	// Without GDB no record exists, and the probe refuses before loading the gem.
	const missing = await observer.run({ gdb: false });
	refused(missing, 2, unattached);
	assert.equal(existsSync(missing.record), false);
	// Under the production deep-bound flags all six entries are armed, including the unreferenced adapter.
	const accepted = await observer.run();
	assert.equal(accepted.code, 0, accepted.output); assert.equal(accepted.stderr, "");
	const observed = readNativeFinDispatch(accepted.stdout, rubyFinDispatchExpected);
	assert.deepEqual(observed, rubyFinDispatchExpected);
	const breakpoints = await assertRubyDispatchRecord(observer, accepted, observed);
	assert.equal(breakpoints.length, 6);
	// A record carrying any other PID than the one GDB armed is refused.
	const foreignPid = await readFile(accepted.record);
	foreignPid.writeBigInt64LE(foreignPid.readBigInt64LE(112) + 1n, 112);
	await writeFile(join(root, "foreign-pid.record"), foreignPid, { flag: "wx" });
	await assert.rejects(() => assertRubyDispatchRecord(observer, { ...accepted, record: join(root, "foreign-pid.record") }, observed), /the record belongs to the instrumented inferior/u);
	// A failed count write or arming callback ends the run with 71, so no rows are accepted.
	const lost = await observer.run({ inject: { write: 3 } });
	assert.equal(lost.code, nativeFinGdbExit.instrumentation, lost.output);
	assert.match(lost.output, /fin instrumentation refused: entry count for column \d failed: injected record write failure/u);
	assert.throws(() => readNativeFinDispatch(lost.stdout ?? "", rubyFinDispatchExpected), TypeError);
	const unarmed = await observer.run({ inject: { arm: true } });
	assert.equal(unarmed.code, nativeFinGdbExit.instrumentation, unarmed.output);
	assert.match(unarmed.output, /fin instrumentation refused: instrumentation callback failed: injected arming failure/u);
	assert.equal(unarmed.stdout, "");
	// A computed-address call of the otherwise unreferenced Fin 0 adapter is an actual counted entry.
	const dynamic = await observer.run({ mode: "dynamic" });
	assert.equal(dynamic.code, 0, dynamic.output);
	const extended = [...rubyFinDispatchExpected, ["dynamic-impossible-adapter", "ok:0", [2, 1, 2, 2, 1, 2]]];
	assert.equal(dynamic.stdout, extended.map(([step, status, counts]) => `${step} ${status} ${counts.join(" ")}\n`).join(""));
	assert.deepEqual(readNativeFinGdbRecord(await readFile(dynamic.record)).entries, [2, 1, 2, 2, 1, 2]);
	// A stale valid record is never adopted, with a fresh nonce or with its own nonce replayed.
	const stale = await readFile(accepted.record);
	for(const nonce of [undefined, accepted.nonce])
	{
		const attempt = await observer.run({ nonce, before: path => writeFile(path, stale, { flag: "wx" }) });
		refused(attempt, nativeFinGdbExit.refusedRecord, null);
		assert.match(attempt.output, /fin instrumentation refused: \[Errno 17\] File exists/u);
		assert.ok((await readFile(attempt.record)).equals(stale), "the stale record is untouched");
	}
	// GDB rooted elsewhere arms nothing in the loaded gem.
	refused(await observer.run({ root: gems.leaking.native }), 3, uncovered);
	// Adapters configured in the wrong library are reported as foreign and never armed.
	const misplaced = Object.fromEntries(nativeFinDispatchSymbols(componentId).map((symbol, k) => [symbol, k < 3 ? "libcomponent_stand_in.so" : "libnative_fin.so"]));
	const wrong = await observe("gem", "wrong", misplaced);
	const misarmed = await wrong.run();
	refused(misarmed, 3, uncovered);
	const partial = readNativeFinGdbRecord(await readFile(misarmed.record));
	assert.deepEqual([partial.armed, partial.foreign, partial.breakpoints], [0b000111, 3, [1, 1, 1, 0, 0, 0]]);
	// A C entry point that enters its adapter before rejecting is caught at its first invalid row.
	const leaking = await observe("leaking", "leak");
	const leak = await leaking.run();
	assert.equal(leak.code, 0, leak.output);
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
		// instrument; its RTLD_DEEPBIND loader bypasses LD_PRELOAD, so entries are counted by GDB breakpoints.
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
		t.diagnostic("per-step source and adapter counts in the relocated Ruby process under GDB entry breakpoints");
		// Installed entry counts need GDB with ptrace; their absence fails this gated acceptance, never skips it.
		assert.ok(existsSync(gdbCommand), `GDB is required at ${gdbCommand} for installed Ruby entry counts; set LEAN_BRIDGE_GDB, and ptrace must be permitted`);
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
		// Without GDB the probe refuses before loading the gem, and no record appears.
		const missing = await observer.run({ gdb: false });
		assert.equal(missing.code, 2, missing.output); assert.equal(missing.stdout, ""); assert.equal(missing.stderr, unattached);
		assert.equal(existsSync(missing.record), false);
		const accepted = await observer.run();
		assert.equal(accepted.code, 0, `instrumented probe failed (70 stale record, 71 ptrace or instrumentation, 72 signal): ${accepted.output}`);
		assert.equal(accepted.stderr, "");
		const observed = readNativeFinDispatch(accepted.stdout, rubyFinDispatchExpected);
		assert.deepEqual(observed, rubyFinDispatchExpected);
		const breakpoints = await assertRubyDispatchRecord(observer, accepted, observed);
		const dispatch = {
			columns: observer.identity.columns
			, observed
			, instrument: "gdb-breakpoints"
			, instrumentation: "in-memory int3 breakpoints at each verified definition; deployed files and the production loader are unchanged"
			, routes: rubyFinDispatchRoutes
			, positiveControl: "valid public Ruby calls increment exactly their source and adapter columns; rejected calls, including every Fin 0 call, change no column"
			, probeSha256: sha256(rubyFinDispatchProbe())
			, scriptSha256: sha256(nativeFinGdbScript)
			, configSha256: observer.configSha256
			, gdb: { version: (await runCopied(gdbCommand, ["--version"], relocated, copiedCleanEnvironment)).stdout.split("\n")[0], sha256: sha256(await readFile(await realpath(gdbCommand))) }
			, definers: observer.identity.definers
			, breakpoints
			, libraries: Object.fromEntries(observer.identity.libraries.map(name => [name, gemLibraries[name]]))
			, scope: "local x86_64 Linux with GDB and ptrace"
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
