/**
 * Checked top-level Fin sites in installed, relocated Ruby gems.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { compileCopiedRubyModel } from "../src/backends/ruby/copied-model.mjs";
import { renderCopiedRubyPackage } from "../src/backends/ruby/copied-values.mjs";
import { verifyNativeFiles } from "../src/build/native-artifacts.mjs";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { supportsNativeRefinementTargets } from "../src/build/native-project.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { corpusReviewedIr } from "./helpers/type-corpus-reviewed-ir.mjs";
import { copiedCleanEnvironment, installCopiedConsumer, nativeFixtureEnvironment, runCopied } from "./helpers/copied-fixture-install.mjs";

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
check(rejected("value", "0") { API.impossible(0) }, "Fin 0 rejects zero")
check(rejected("value", "0") { API.impossible(1) }, "Fin 0 rejects one")
check(API.only(0) == 7, "Fin 1 accepts zero")
check(rejected("value", "1") { API.only(1) }, "Fin 1 rejects its bound")
check(API.mirror(0) == 9 && API.mirror(9) == 0, "Fin 10 endpoints")
check(API.mirror(4).instance_of?(Integer) && API.mirror(4) == 5, "exact Integer results")
[10, 11, word, huge].each { |value| check(rejected("value", "10") { API.mirror(value) }, "Fin 10 rejects #{value}") }
check(raises(RangeError) { API.mirror(-1) } && !rejected("value", "10") { API.mirror(-1) }, "negative is the Nat RangeError")
[true, false, 1.0, "1", nil].each { |value| check(raises(TypeError) { API.mirror(value) }, "non-Integer is TypeError: #{value.inspect}") }
check(API.twice(299) == 598, "alias accepts its largest value")
check(rejected("value", "300") { API.twice(300) }, "alias rejects its bound")
check(rejected("value", "300") { API.twice(301) }, "alias rejects beyond its bound")
check(API.succ_huge(word) == word + 1, "large Fin crosses a limb")
check(API.succ_huge(huge - 2) == huge - 1 && API.succ_huge(huge - 1) == huge - 1, "large Fin endpoints")
[huge, huge + 1, 1 << 128].each { |value| check(rejected("value", huge.to_s) { API.succ_huge(value) }, "large Fin rejects #{value}") }
check(API.wrap(100) == 2 && API.wrap(huge) == 2 && API.wrap(0) == 0, "result-only Fin values")
base, name = 5, "slot".dup.freeze
check(API.label(base, 3, name) == "slot:8", "mixed arguments")
check(rejected("offset", "4") { API.label(base, 4, name) }, "mixed arguments reject the Fin site")
check(raises(TypeError) { API.label(base, true, name) }, "mixed arguments reject true")
check(base == 5 && name == "slot" && API.label(base, 0, name) == "slot:5", "caller data unchanged")
1000.times do |i|
  raise "invalid call accepted at #{i}" unless rejected("value", "10") { API.mirror(10 + i) }
  raise "valid call failed at #{i}" unless API.mirror(i % 10) == 9 - i % 10
end
$checks += 2000
puts "ruby-fin-ok:#{$checks}"
`;

test("Ruby gems are checked Fin consumers beside C, C++, Python and Rust", () => {
	for(const targets of [["rubygems"], ["c", "rubygems"], ["c", "cpp", "pypi", "cargo", "rubygems"]])
		assert.equal(supportsNativeRefinementTargets(targets), true, targets.join(","));
	for(const target of ["cpan"])
		assert.equal(supportsNativeRefinementTargets(["rubygems", target]), false, target);
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
	label.source.extensions["lean-lang.org/refinements"] = { parameters: [null, { kind: "subtype", constructor: "Fins.check" }, null], result: null };
	assert.throws(() => renderCopiedRubyPackage(compileCopiedRubyModel(ir)), TypeError);
});

test("relocated source-free Ruby gems check Fin bounds through the bundled C adapter", { skip: process.env.LEAN_BRIDGE_RUBY_FIN_TEST !== "1", timeout: 2_400_000 }, async t => {
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
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1
			, modules: ["NativeFin"]
			, targets: { c: { name: "native-fin", version: "1.0.0" }, rubygems: { name: "native-fin", version: "1.0.0" } } }));
		t.diagnostic(`build ${attempt}: compiling the shared C library and Ruby gem`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c", "rubygems"], environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		assert.deepEqual(Object.fromEntries(model.exports.map(item => [item.name, bounds(item.refinements)])), expectedBounds);
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
		// instrument; its RTLD_DEEPBIND loader deliberately prevents LD_PRELOAD counters.
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
		reports.push({ profile: "ruby", path: "ordinary-source"
			, ...observation
			, packages
			, sharedNativeLibraries: Object.fromEntries(shared.map(name => [name, gemLibraries[name]]))
			, dispatch: { observed: false, reason: "RTLD_DEEPBIND loader isolates verified libraries from LD_PRELOAD interposition; identity with the instrumented C adapter is asserted instead" }
			, bindingIrSha256: built.bindingIrSha256
			, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
			, modelSha256: sha256(canonicalJson(model))
			, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
			, sourceRemovedBeforeInstallation: true
			, relocatedInstallation: true, repeatExecution: true
			, installedFilesSha256: sha256(canonicalJson(gemReceipt.files)) });
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	await saveLakeFile("build/native-fin", "ruby.json", canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
