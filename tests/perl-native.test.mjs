/**
 * Installed ordinary-project Perl coverage, including fail-closed installation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { chmod, copyFile, cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildNativeComponent, buildNativeSharedRuntime } from "../src/build/native-component.mjs";
import { buildNativeProject } from "../src/build/native-project.mjs";
import { readExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { createMetadataRequest } from "../src/analyze/elaborated-metadata.mjs";
import { stageCpanPackage, archiveCpanPackage } from "../src/release/cpan-package.mjs";
import { compileCpanXsVariant } from "../src/build/perl-xs.mjs";
import { installCpanArchive } from "../scripts/test-perl-package-consumer.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { benchmarkPerl } from "../scripts/benchmark-perl.mjs";
import { traceCpanInstall } from "../src/release/cpan-install-trace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";
import { lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";

const enabled = process.env.LEAN_BRIDGE_PERL_NATIVE_TEST === "1";
const root = process.cwd();
const leanPrefix = process.env.LEAN_BRIDGE_LEAN_PREFIX ?? join(root, ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const perl = process.env.LEAN_BRIDGE_TEST_PERL ?? "/usr/bin/perl";
const floor = process.env.LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR ?? "2.38";
const run = (command, args, cwd, env = process.env) => processBuildRunner.capture({ command, args, cwd, env });
const errorText = error => `${error.message}\n${JSON.stringify(error.details ?? {})}`;

const metadataProject = async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-native-metadata-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const projectRoot = join(working, "project");
	await saveLakeFile(projectRoot, "lean-toolchain", "leanprover/lean4:v4.32.2\n");
	await saveLakeFile(projectRoot, "lakefile.toml", 'name = "sample"\nversion = "1.0.0"\n[[lean_lib]]\nname = "Sample"\n');
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Sample"], exports: ["Sample.increment"] }));
	await saveLakeFile(projectRoot, "Sample.lean", `namespace Sample
abbrev Word := UInt32
abbrev Unary := Word → Word
/-- 🙂 Keep the native alias. -/
def increment : Unary := fun value => value + 1
theorem increment_spec (value : Word) : increment value = value + 1 := rfl
namespace Shadow
def increment (value : Word) : Word := value
theorem increment_spec (value : Word) : increment value = value := rfl
end Shadow
private def secret : Word := 7
def unsupportedHelper : Array (Word → Word) := #[]
end Sample
`);
	for(const path of await readdir(projectRoot)) await chmod(join(projectRoot, path), 0o444);
	return { working, projectRoot, runtimeRoot: join(working, "runtime"), leanPrefix };
};

const specializationProject = async (t, withContracts = false) => {
	const context = await metadataProject(t);
	const source = join(context.projectRoot, "Sample.lean"), configuration = join(context.projectRoot, "lean-bridge.exports.json");
	await chmod(source, 0o644); await chmod(configuration, 0o644);
	await writeFile(source, `namespace Sample
universe u v
abbrev Word := UInt32
abbrev Words := Array Word
abbrev Unary := Word → Word
structure Point where
  x : Word
  y : Word
structure Counter where
  label : String
  value : Word
abbrev Counters := Array Counter
abbrev Callbacks := Array Unary
/-- 🙂 Return the concrete value without changing it. -/
def echo {α : Type u} (value : α) : α := value
theorem echo_spec {α : Type u} (value : α) : echo value = value := rfl
instance (priority := high) : Inhabited UInt32 := ⟨37⟩
def choose {α : Type u} [Inhabited α] (useValue : Bool) (value : α) : α :=
  if useValue then value else default
def first (α : Type u) (β : Type v) (a : α) (_b : β) : α := a
def makeAdder {α : Type u} [Add α] (base : α) : α → α := fun value => base + value
def apply {α : Type u} (fn : α → α) (value : α) : α := fn value
def makeCounter (value : Word) : Counter := ⟨"counter", value⟩
def readCounter (value : Counter) : Word := value.value
def plain (value : Word) : Word := value + 3
def effect {α : Type} (value : α) : IO α := pure value
def admitted {α : Type u} (value : α) : α := by sorry
end Sample
namespace LeanBridgeNative${sha256("sample@1.0.0").slice(0, 16)}
def Sample.plain (value : _root_.UInt32) := value + 99
def Sample.Point.mk (x y : _root_.UInt32) : _root_.Sample.Point := ⟨y, x⟩
def Sample.Point.x (value : _root_.Sample.Point) := value.y
abbrev Sample.Point := _root_.Sample.Point
abbrev UInt32 := UInt64
end LeanBridgeNative${sha256("sample@1.0.0").slice(0, 16)}
`);
	const specializations = [
		["echoWord", "echo", ["Sample.Word"]]
		, ["echoText", "echo", ["String"]]
		, ["echoNat", "echo", ["Nat"]]
		, ["echoInt", "echo", ["Int"]]
		, ["echoWords", "echo", ["Sample.Words"]]
		, ["echoPoint", "echo", ["Sample.Point"]]
		, ["echoCounter", "echo", ["Sample.Counter"]]
		, ["echoUnary", "echo", ["Sample.Unary"]]
		, ["chooseWord", "choose", ["UInt32"]]
		, ["firstWord", "first", ["UInt32", "String"]]
		, ["makeWordAdder", "makeAdder", ["UInt32"]]
		, ["applyWord", "apply", ["UInt32"]]
	].map(([name, declaration, types]) => ({ name: `Sample.${name}`, declaration: `Sample.${declaration}`, types }));
	const config = { schemaVersion: 1
		, modules: ["Sample"], specializations
		, exports: [...specializations.map(item => item.name), "Sample.makeCounter", "Sample.readCounter", "Sample.plain"]
		, resources: ["Sample.Counter"]
		, arities: { "Sample.makeWordAdder": 1, "Sample.echoUnary": 1 }
		, targets: { cpan: { module: "LeanBridge::Concrete", version: "0.002" } } };
	if(withContracts)
	{
		const copy = { ownership: "copy", lifetime: null };
		const borrow = { ownership: "borrow", lifetime: { scope: "call", anchor: null } };
		const lease = { ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
		config.contracts = {
			"Sample.echoPoint": { parameters: [copy], result: { ...copy, refinement: "reject" }, effects: [] }
			, "Sample.echoWords": { parameters: [copy], result: copy }
			, "Sample.echoCounter": { parameters: [borrow], result: lease, effects: [] }
			, "Sample.readCounter": { parameters: [borrow], result: copy }
			, "Sample.makeCounter": { parameters: [copy], result: lease }
			, "Sample.makeWordAdder": { parameters: [copy], result: lease, effects: [] }
			, "Sample.applyWord": { parameters: [borrow, copy], result: copy, effects: ["host-call", "fails"] }
		};
	}
	await writeFile(configuration, canonicalJson(config));
	await chmod(source, 0o444); await chmod(configuration, 0o444);
	return { ...context, config };
};

test("native finite specializations reproduce and install concrete Perl APIs", { skip: !enabled, timeout: 600_000 }, async t => {
	const context = await specializationProject(t, true), before = await lakeInputState(context.projectRoot);
	const moved = join(context.working, "relocated");
	await cp(context.projectRoot, moved, { recursive: true });
	const movedBefore = await lakeInputState(moved), releases = [];
	for(const [index, projectRoot] of [context.projectRoot, moved].entries())
	{
		const outputRoot = join(context.working, `release-${index}`);
		const result = await buildNativeProject({ projectRoot, outputRoot
			, targets: ["cpan"]
			, environment: { ...process.env, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix, LEAN_BRIDGE_PERLS: JSON.stringify([perl]) } })
			.catch(error => { throw new Error(errorText(error), { cause: error }); });
		releases.push({ outputRoot, result });
	}
	assert.deepEqual(releases[0].result.packages, releases[1].result.packages);
	for(const entry of releases[0].result.packages)
		assert.equal(sha256(await readFile(join(releases[0].outputRoot, "archives", entry.archive))), sha256(await readFile(join(releases[1].outputRoot, "archives", entry.archive))));
	const nativeRoot = join(releases[0].outputRoot, "native/component");
	const model = JSON.parse(await readFile(join(nativeRoot, "model.json"), "utf8"));
	const metadata = JSON.parse(await readFile(join(nativeRoot, "metadata.json"), "utf8"));
	await assertJsonSchema("elaborated-export-metadata", metadata);
	assert.equal(model.exports.length, 15);
	assert.deepEqual(model.bindingIr.assurance, []);
	for(const [name, contract] of Object.entries(context.config.contracts))
	{
		const declaration = model.bindingIr.declarations.find(item => item.id === `lean:${name}`);
		const normalized = { ...contract, ...(contract.effects ? { effects: contract.effects.toSorted() } : {}) };
		assert.deepEqual(declaration.source.extensions["lean-lang.org/export-contract"], normalized);
		assert.deepEqual(declaration.assurance, []);
		assert.deepEqual(declaration.parameters.map(({ ownership, lifetime }) => ({ ownership, lifetime })), contract.parameters);
	}
	const echo = model.bindingIr.declarations.find(item => item.name === "echoPoint");
	assert.equal(echo.source.declaration, "Sample.echo");
	assert.deepEqual(echo.source.extensions["lean-lang.org/theorem-references"], ["Sample.echo_spec"]);
	assert.match(echo.documentation.summary, /🙂 Return the concrete value/);
	assert.deepEqual(echo.typeParameters, []);
	assert.deepEqual(echo.assurance, []);
	assert.equal(model.exports.find(item => item.publicName === "make_word_adder").result.kind, "callback");
	assert.equal(model.exports.find(item => item.publicName === "make_word_adder").parameters.length, 1);
	assert.deepEqual(await lakeInputState(context.projectRoot), before);
	assert.deepEqual(await lakeInputState(moved), movedBefore);
	// Installed execution has no author source tree to fall back to.
	await rename(context.projectRoot, join(context.working, "source-hidden"));
	await rename(moved, join(context.working, "relocated-hidden"));
	const detached = join(context.working, "detached");
	await mkdir(detached);
	await saveLakeFile(detached, "consumer.t", `use strict;
use warnings;
use utf8;
use Test::More;
use Math::BigInt;
use Scalar::Util qw(refaddr);
use LeanBridge::Concrete;
is(LeanBridge::Concrete::echo_word(4294967295), 4294967295, 'concrete alias');
is(LeanBridge::Concrete::echo_text("A\\0λ🙂"), "A\\0λ🙂", 'concrete String');
my $big = Math::BigInt->new(2)->bpow(100);
is(LeanBridge::Concrete::echo_nat($big)->bstr, $big->bstr, 'concrete Nat');
is(LeanBridge::Concrete::echo_int($big->copy->bneg)->bstr, $big->copy->bneg->bstr, 'concrete Int');
is(LeanBridge::Concrete::choose_word(LeanBridge::Concrete::false(), 9), 37, 'compiler-selected custom dictionary');
is(LeanBridge::Concrete::first_word(71, 'ignored'), 71, 'two type parameters');
is(LeanBridge::Concrete::plain(71), 74, 'ordinary namespace shadow cannot redirect the call');
is_deeply(LeanBridge::Concrete::echo_words([0, 42, 4294967295]), [0, 42, 4294967295], 'copied array');
my $point = LeanBridge::Concrete::Point->new(x => 7, y => 19);
my $copy = LeanBridge::Concrete::echo_point($point);
is_deeply($copy, $point, 'record constructors and projections use absolute names');
isnt(refaddr($copy), refaddr($point), 'record is copied');
my $counter = LeanBridge::Concrete::make_counter(42);
is(refaddr(LeanBridge::Concrete::echo_counter($counter)), refaddr($counter), 'resource keeps canonical identity');
is(LeanBridge::Concrete::read_counter($counter), 42, 'resource stays usable');
$counter->close;
my $adder = LeanBridge::Concrete::make_word_adder(7);
is($adder->call(35), 42, 'specialization arity preserves a returned closure');
my $same = LeanBridge::Concrete::echo_unary($adder);
is(refaddr($same), refaddr($adder), 'closure alias keeps canonical identity');
is(LeanBridge::Concrete::apply_word($adder, 35), 42, 'Lean callback');
is(LeanBridge::Concrete::apply_word(sub { $_[0] + 1 }, 41), 42, 'synchronous Perl callback');
my $exception = bless {}, 'ConcreteFailure';
eval { LeanBridge::Concrete::apply_word(sub { die $exception }, 0) };
is(refaddr($@), refaddr($exception), 'callback preserves the original exception');
$adder->close;
eval { LeanBridge::Concrete::echo_word(-1) }; like($@, qr/integer/, 'invalid scalar rejected');
ok(!LeanBridge::Concrete->can('echo'), 'unbound generic is absent');
done_testing;
`);
	for(const mode of ["prebuilt-only", "build-xs"])
	{
		const prefix = join(context.working, mode);
		for(const entry of releases[0].result.packages)
			await installCpanArchive({ archive: join(releases[0].outputRoot, "archives", entry.archive), workingRoot: context.working, prefix, perl, mode })
				.catch(error => { throw new Error(`${mode} ${entry.archive}: ${errorText(error)}`, { cause: error }); });
		const result = await run(perl, ["consumer.t"], detached, { ...process.env, PERL5LIB: join(prefix, "lib/perl5") })
			.catch(error => { throw new Error(errorText(error), { cause: error }); });
		assert.match(result.stdout, /1\.\.19/);
		assert.doesNotMatch(result.stdout, /^not ok/m);
	}
	const entry = releases[0].result.packages[1];
	t.diagnostic(`Finite CPAN archive SHA-256: ${sha256(await readFile(join(releases[0].outputRoot, "archives", entry.archive)))}`);
	// Rehashing the report and receipt cannot substitute an application or contract.
	const originalReceipt = JSON.parse(await readFile(join(nativeRoot, "native-component.json"), "utf8"));
	for(const mode of ["application", "contract"])
	{
		const report = structuredClone(metadata), receipt = structuredClone(originalReceipt), forged = structuredClone(model);
		if(mode === "application")
			report.modules[0].declarations.find(item => item.identity === "Sample.echoWord").specialization.application = "fun (value : UInt32) => value + 1";
		else
		{
			const { metadata: context, ...selection } = receipt.sourceIdentity.request;
			selection.contracts["Sample.applyWord"].effects = [];
			receipt.sourceIdentity.request = createMetadataRequest(selection, {
				toolchain: context.toolchain, modules: context.modules
				, leanCompilerSha256: receipt.sourceIdentity.leanCompilerSha256
				, extractorSha256: receipt.sourceIdentity.extractorSha256 });
			report.producer.invocationIdentitySha256 = receipt.sourceIdentity.request.metadata.invocationIdentitySha256;
			forged.sourceIdentity = receipt.sourceIdentity;
		}
		receipt.metadataSha256 = sha256(canonicalJson(report));
		receipt.modelSha256 = sha256(canonicalJson(forged));
		await writeFile(join(nativeRoot, "metadata.json"), canonicalJson(report));
		await writeFile(join(nativeRoot, "model.json"), canonicalJson(forged));
		await writeFile(join(nativeRoot, "native-component.json"), canonicalJson(receipt));
		const artifacts = JSON.parse(await readFile(join(nativeRoot, "artifacts.json"), "utf8"));
		for(const path of ["metadata.json", "model.json", "native-component.json"])
		{
			const bytes = await readFile(join(nativeRoot, path));
			artifacts.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
		}
		await writeFile(join(nativeRoot, "artifacts.json"), canonicalJson(artifacts));
		await assert.rejects(() => stageCpanPackage({ componentRoot: nativeRoot
			, runtimeRoot: join(releases[0].outputRoot, "native/runtime"), leanPrefix
			, outputRoot: join(context.working, `forged-${mode}`) }), mode === "application"
			? /model differs from shared compiler metadata/ : /violates its configured export contract/);
	}
});

test("native export contracts reject unsupported decisions before linking", { skip: !enabled, timeout: 300_000 }, async t => {
	const context = await specializationProject(t);
	await buildNativeSharedRuntime({ outputRoot: context.runtimeRoot, leanPrefix });
	const copy = { ownership: "copy", lifetime: null };
	const borrow = { ownership: "borrow", lifetime: { scope: "call", anchor: null } };
	const lease = { ownership: "lease", lifetime: { scope: "explicit", anchor: null } };
	for(const [label, name, contract] of [
		["copied-resource", "echoCounter", { parameters: [copy] }]
		, ["borrowed-result", "makeCounter", { result: borrow }]
		, ["transfer", "readCounter", { parameters: [{ ...lease, ownership: "transfer" }] }]
		, ["retained-callback", "applyWord", { parameters: [lease, copy] }]
		, ["callback-effects", "applyWord", { effects: [] }]
		, ["closure-arity", "makeWordAdder", { parameters: [copy, copy] }]
		, ["refinement", "plain", { result: { ...copy, refinement: { constructor: "Sample.checked" } } }]
		, ["unknown", "missing", { effects: [] }]
	]) await t.test(label, async () => {
		const config = { ...context.config, contracts: { [`Sample.${name}`]: contract } };
		if(label === "unknown") config.exports = [...config.exports, "Sample.missing"];
		const path = join(context.projectRoot, "lean-bridge.exports.json");
		await chmod(path, 0o644); await writeFile(path, canonicalJson(config)); await chmod(path, 0o444);
		const before = await lakeInputState(context.projectRoot);
		let extractions = 0;
		const runner = { capture: async request => {
			assert.notEqual(request.args[0], "-shared", "Invalid contract reached linking");
			if(request.args.includes("--metadata")) extractions++;
			return processBuildRunner.capture(request);
		} };
		await assert.rejects(() => buildNativeComponent({ ...context, outputRoot: join(context.working, label), runner }), error => {
			assert.equal(error.code, "native-elaboration-unsupported", errorText(error));
			assert.match(errorText(error), label === "unknown" ? /unused-export-contract/ : /export-contract-mismatch/);
			return true;
		});
		assert.equal(extractions, 1);
		assert.deepEqual(await readdir(context.working), ["project", "runtime"]);
		assert.deepEqual(await lakeInputState(context.projectRoot), before);
	});
});

test("native specializations reject changed applications and unsupported ownership before linking", { skip: !enabled, timeout: 300_000 }, async t => {
	const context = await specializationProject(t);
	await buildNativeSharedRuntime({ outputRoot: context.runtimeRoot, leanPrefix });
	for(const mode of ["application", "types", "late-json", "source", "resource-array", "callback-array", "instance", "effect", "admitted"])
		await t.test(mode, async () => {
			const invalid = { "resource-array": ["echo", "Sample.Counters"]
				, "callback-array": ["echo", "Sample.Callbacks"]
				, instance: ["choose", "Sample.Point"]
				, effect: ["effect", "UInt32"]
				, admitted: ["admitted", "UInt32"] }[mode];
			const config = invalid ? { schemaVersion: 1, modules: ["Sample"]
				, exports: ["Sample.invalid"], resources: ["Sample.Counter"]
				, specializations: [{ name: "Sample.invalid", declaration: `Sample.${invalid[0]}`, types: [invalid[1]] }] } : context.config;
			const path = join(context.projectRoot, "lean-bridge.exports.json");
			await chmod(path, 0o644); await writeFile(path, canonicalJson(config)); await chmod(path, 0o444);
			const before = await lakeInputState(context.projectRoot);
			let extractions = 0, linked = false;
			const runner = { capture: async request => {
				if(request.args[0] === "-shared") linked = true;
				const result = await processBuildRunner.capture(request);
				if(request.args.includes("--metadata"))
				{
					extractions++;
					if(extractions === 2)
					{
						if(mode === "late-json") return { ...result, stdout: "{invalid" };
						const report = JSON.parse(result.stdout);
						const item = report.modules[0].declarations.find(item => item.identity === "Sample.echoWord");
						if(mode === "application") item.specialization.application = "fun (value : UInt32) => value + 1";
						if(mode === "types") item.specialization.types = ["String"];
						if(mode === "source") await writeFile(join(dirname(request.args.at(-1)), "source/Sample.lean"), "-- changed\n");
						return { ...result, stdout: canonicalJson(report) };
					}
				}
				return result;
			} };
			const code = invalid ? "native-elaboration-unsupported" : mode === "late-json" ? "lean-metadata-extractor-failed" : "native-elaboration-drift";
			await assert.rejects(() => buildNativeComponent({ ...context, outputRoot: join(context.working, mode), runner }), error => {
				assert.equal(error.code, code, errorText(error));
				if(mode === "resource-array") assert.match(errorText(error), /ownership policy/);
				if(mode === "callback-array") assert.match(errorText(error), /retention policy/);
				return true;
			});
			assert.equal(extractions, invalid ? 1 : 2);
			assert.equal(linked, false);
			assert.deepEqual(await readdir(context.working), ["project", "runtime"]);
			assert.deepEqual(await lakeInputState(context.projectRoot), before);
		});
});

test("native shared metadata preserves checked aliases, docs and proof relationships across relocation", { skip: !enabled, timeout: 180_000 }, async t => {
	const context = await metadataProject(t), before = await lakeInputState(context.projectRoot);
	await buildNativeSharedRuntime({ outputRoot: context.runtimeRoot, leanPrefix });
	const outputRoot = join(context.working, "native");
	const first = await buildNativeComponent({ ...context, outputRoot });
	const metadata = JSON.parse(await readFile(join(outputRoot, "metadata.json"), "utf8"));
	await assertJsonSchema("elaborated-export-metadata", metadata);
	assert.equal(metadata.profile, "native-library-v1");
	const declarations = metadata.modules[0].declarations;
	const item = declarations.find(item => item.identity === "Sample.increment");
	assert.match(item.documentation, /🙂 Keep the native alias/);
	assert.equal(item.source.startLine, 4);
	assert.deepEqual(item.theoremReferences, ["Sample.increment_spec"]);
	assert.equal(item.projection.parameters[0].type.abi.cType, "uint32_t");
	assert.deepEqual(first.model.bindingIr.declarations[0].source.extensions["lean-lang.org/theorem-references"], ["Sample.increment_spec"]);
	assert.deepEqual(first.model.bindingIr.declarations[0].assurance, []);
	assert.equal(declarations.find(item => item.identity === "Sample.unsupportedHelper").projection.reason, "unsupported-native-type");
	assert.ok(declarations.some(item => item.visibility === "private"));
	assert.deepEqual(metadata.diagnostics, []);
	const relocated = join(context.working, "relocated");
	await cp(context.projectRoot, relocated, { recursive: true });
	const second = await buildNativeComponent({ ...context, projectRoot: relocated, outputRoot: join(context.working, "second") });
	assert.deepEqual(second.receipt, first.receipt);
	assert.deepEqual(second.model, first.model);
	assert.deepEqual(await lakeInputState(context.projectRoot), before);
	const forged = structuredClone(metadata);
	forged.modules[0].declarations.find(item => item.identity === "Sample.increment").documentation = "Unrelated metadata";
	await writeFile(join(outputRoot, "metadata.json"), canonicalJson(forged));
	const receipt = structuredClone(first.receipt);
	receipt.metadataSha256 = sha256(canonicalJson(forged));
	await writeFile(join(outputRoot, "native-component.json"), canonicalJson(receipt));
	const artifacts = JSON.parse(await readFile(join(outputRoot, "artifacts.json"), "utf8"));
	for(const path of ["metadata.json", "native-component.json"])
	{
		const bytes = await readFile(join(outputRoot, path));
		artifacts.files[path] = { bytes: bytes.length, sha256: sha256(bytes) };
	}
	await writeFile(join(outputRoot, "artifacts.json"), canonicalJson(artifacts));
	await assert.rejects(() => stageCpanPackage({ ...context, componentRoot: outputRoot, outputRoot: join(context.working, "package") }), /model differs from shared compiler metadata/);
});

test("native extraction rejects forged reports, interface drift and ABI disagreement without releasing output", { skip: !enabled, timeout: 300_000 }, async t => {
	const context = await metadataProject(t), before = await lakeInputState(context.projectRoot);
	await buildNativeSharedRuntime({ outputRoot: context.runtimeRoot, leanPrefix });
	for(const mode of ["failure", "json", "identity", "source", "sidecar", "late-sidecar", "abi", "cancel"])
		await t.test(mode, async () => {
			let staging, invoked = false, linked = false;
			const cancellation = new AbortController();
			const runner = { capture: async request => {
				if(request.args[0] === "-shared") linked = true;
				if(request.args.includes("--metadata"))
				{
					invoked = true; staging = dirname(request.args.at(-1));
					if(mode === "failure") throw new Error("Extractor execution failed");
					if(mode === "json") return { stdout: "{incomplete", stderr: "", code: 0 };
					if(mode === "cancel")
					{
						cancellation.abort(new Error("Cancelled native extraction"));
						throw cancellation.signal.reason;
					}
					const result = await processBuildRunner.capture(request), metadata = JSON.parse(result.stdout);
					if(mode === "identity") metadata.modules[0].interfaceSha256 = "0".repeat(64);
					if(mode === "source") await writeFile(join(staging, "source/Sample.lean"), "-- altered after extraction\n");
					if(mode === "sidecar") await writeFile(join(staging, "olean/Sample.olean.server"), "changed metadata");
					if(mode === "abi")
					{
						const item = metadata.modules[0].declarations.find(item => item.identity === "Sample.increment");
						item.projection.result.abi = { cType: "uint64_t", box: "lean_box_uint64", unbox: "lean_unbox_uint64", heap: false };
					}
					return { ...result, stdout: canonicalJson(metadata) };
				}
				const result = await processBuildRunner.capture(request);
				if(mode === "late-sidecar" && request.args.includes(join(staging ?? "", "c/adapter.c")))
					await writeFile(join(staging, "olean/Sample.olean.private"), "changed after adapter compilation");
				return result;
			} };
			const outputRoot = join(context.working, mode);
			await assert.rejects(() => buildNativeComponent({ ...context, outputRoot, runner, signal: cancellation.signal }), error => {
				if(mode === "cancel") return /Cancelled native extraction/.test(errorText(error));
				if(mode === "abi") return /conflicting types/.test(errorText(error));
				const code = ["failure", "json"].includes(mode) ? "lean-metadata-extractor-failed"
					: mode === "identity" ? "invalid-elaborated-metadata" : "native-elaboration-drift";
				return error.code === code;
			}, mode);
			assert.equal(invoked, true);
			assert.equal(linked, false);
			await assert.rejects(() => lstat(staging), { code: "ENOENT" });
			await assert.rejects(() => lstat(outputRoot), { code: "ENOENT" });
			assert.deepEqual(await lakeInputState(context.projectRoot), before);
		});
});

test("Perl CBuilder receives development headers without Nix build-role variables", { skip: !enabled }, async t => {
	const working = await mkdtemp(join(tmpdir(), "lean-bridge-perl-headers-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const include = join(working, "development headers");
	await mkdir(include);
	await writeFile(join(include, "lean_bridge_header_probe.h"), "#define LEAN_BRIDGE_HEADER_VALUE 7\n");
	await writeFile(join(working, "probe.c"), "#include <lean_bridge_header_probe.h>\nint probe(void) { return LEAN_BRIDGE_HEADER_VALUE; }\n");
	const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("NIX_") && !["CPATH", "C_INCLUDE_PATH", "CPLUS_INCLUDE_PATH", "OBJC_INCLUDE_PATH"].includes(key)));
	const args = ["-MExtUtils::CBuilder", "-e", 'ExtUtils::CBuilder->new(quiet => 0)->compile(source => "probe.c", object_file => "probe.o");'];
	await assert.rejects(() => run(perl, args, working, environment), error => /lean_bridge_header_probe\.h/.test(errorText(error)));
	await run(perl, args, working, { ...environment, C_INCLUDE_PATH: include });
	assert.ok((await readFile(join(working, "probe.o"))).length > 0);
});

test("shared configuration drives a compiled and installed native package", { skip: !enabled, timeout: 600_000 }, async t => {
	await mkdir("build", { recursive: true });
	const working = await mkdtemp(join(root, "build/.shared-native-test-"));
	t.after(() => rm(working, { recursive: true, force: true }));
	const projectRoot = join(root, "tests/fixtures/export-selection");
	const before = await readExportConfiguration(projectRoot);
	const output = join(working, "release");
	let result;
	try
	{
		result = await buildNativeProject({
			projectRoot, outputRoot: output, targets: ["cpan"]
			, environment: { ...process.env
				, LEAN_BRIDGE_LEAN_PREFIX: leanPrefix
				, LEAN_BRIDGE_PERLS: JSON.stringify([perl]) } });
	} catch(error)
	{
		throw new Error(errorText(error), { cause: error });
	}
	assert.equal(result.configurationSha256, before.sha256);
	assert.equal(result.packages[1].archive, "LeanBridge-Selected-0.007.tar.gz");
	const manifest = JSON.parse(await readFile(join(output, "packages/component/lean-bridge-package.json"), "utf8"));
	assert.equal(manifest.module, "LeanBridge::Selected");
	assert.equal(manifest.version, "0.007");
	const model = JSON.parse(await readFile(join(output, "native/component/model.json"), "utf8"));
	assert.deepEqual(model.exports.map(item => item.name), ["First.bump"]);
	const prefix = join(working, "installed");
	for(const entry of result.packages)
		await installCpanArchive({ archive: join(output, "archives", entry.archive)
			, workingRoot: working, prefix, perl, mode: "prebuilt-only" });
	const consumer = await run(perl, ["-MLeanBridge::Selected", "-e", "print LeanBridge::Selected::bump(41)"], working,
		{ ...process.env, PERL5LIB: join(prefix, "lib/perl5") });
	assert.equal(consumer.stdout, "42");
	assert.deepEqual(await readExportConfiguration(projectRoot), before);
});

test("Perl installs ordinary Lean packages through prebuilt and XS-only paths", { skip: !enabled, timeout: 600_000 }, async t => {
  await mkdir("build", { recursive: true });
  const working = await mkdtemp(join(root, "build/.perl-native-test-"));
  const runtimeRoot = join(working, "runtime"), nativeRoot = join(working, "native"), packages = join(working, "packages");
  const prefix = join(working, "installed"), fallback = join(working, "fallback");
  const env = { ...process.env, PERL5LIB: join(prefix, "lib/perl5") };
  try
{
    await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
    const built = await buildNativeComponent({ projectRoot: join(root, "tests/fixtures/perl/ordinary")
    , outputRoot: nativeRoot
      , runtimeRoot, leanPrefix, resources: ["Workshop.Counter"]
      , arities: { "Workshop.makeAdder": 1, "Workshop.keepCallback": 1, "Workshop.newRunner": 1 } });
    assert.equal(built.model.exports.length, 50);
    const runtimePackage = join(packages, "runtime"), componentPackage = join(packages, "component");
    await stageCpanPackage({ outputRoot: runtimePackage, runtimeRoot, leanPrefix, glibcMinimumVersion: floor });
    const runtimeVariant = await compileCpanXsVariant({ packageRoot: runtimePackage, perl });
    const runtimeXsReceipt = JSON.parse(await readFile(join(runtimePackage, "prebuilt", runtimeVariant.abiKey, "receipt.json"), "utf8"));
    assert.equal(runtimeXsReceipt.commands.find(command => command.includes("-c")).filter(flag => /^-g/.test(flag)).at(-1), "-g0");
    const runtimeArchive = await archiveCpanPackage({ packageRoot: runtimePackage, outputRoot: join(working, "archives") });
    const noCompiler = join(working, "no-compiler"); await mkdir(noCompiler);
    for(const name of ["cc", "c++", "gcc", "g++", "clang", "clang++", "x86_64-linux-gnu-gcc", "lean", "lake", "node"])
{
      await copyFile(join(root, "tests/fixtures/perl/deny-tool.sh"), join(noCompiler, name)); await chmod(join(noCompiler, name), 0o755);
}
    const prebuiltEnv = { ...env, PATH: `${noCompiler}:${process.env.PATH}` };
    await installCpanArchive({ archive: runtimeArchive.path, workingRoot: working, prefix, perl, mode: "prebuilt-only", environment: prebuiltEnv });
    await stageCpanPackage({ outputRoot: componentPackage, runtimeRoot, componentRoot: nativeRoot, leanPrefix, version: "0.002", glibcMinimumVersion: floor });
    const metadata = JSON.parse(await readFile(join(componentPackage, "META.json"), "utf8"));
    assert.deepEqual(metadata.license, ["unknown"]);
    assert.deepEqual(metadata.author, ["Author not declared"]);
    assert.equal(metadata.resources, undefined);
    assert.equal(metadata.prereqs.runtime.requires["LeanBridge::Runtime"], "0.001", "component releases do not advance the shared runtime version");
    await compileCpanXsVariant({ packageRoot: componentPackage, perl, environment: env });
    const archive = await archiveCpanPackage({ packageRoot: componentPackage, outputRoot: join(working, "archives") });
    const metadataCheck = join(working, "metadata-check");
    await cp(componentPackage, metadataCheck, { recursive: true });
    await run(perl, ["Makefile.PL", `INSTALL_BASE=${prefix}`], metadataCheck, { ...env, LEAN_BRIDGE_PERL_INSTALL_MODE: "prebuilt-only" });
    const configuredMetadata = JSON.parse(await readFile(join(metadataCheck, "MYMETA.json"), "utf8"));
    assert.deepEqual(configuredMetadata.license, ["unknown"]);
    assert.deepEqual(configuredMetadata.author, ["Author not declared"]);
    await installCpanArchive({ archive: archive.path, workingRoot: working, prefix, perl, mode: "prebuilt-only", environment: prebuiltEnv });
    const otherProject = join(working, "other-source");
    await cp(join(root, "tests/fixtures/perl/other"), otherProject, { recursive: true });
    await copyFile(join(root, "tests/fixtures/perl/ordinary/Workshop.lean"), join(otherProject, "Workshop.lean"));
    const otherNative = join(working, "other-native"), otherPackage = join(packages, "other");
    await buildNativeComponent({ projectRoot: otherProject
    , outputRoot: otherNative
    , runtimeRoot
    , leanPrefix
      , modules: ["Other"], resources: ["Workshop.Counter"] });
    await stageCpanPackage({ outputRoot: otherPackage, runtimeRoot, componentRoot: otherNative, leanPrefix, glibcMinimumVersion: floor });
    await compileCpanXsVariant({ packageRoot: otherPackage, perl, environment: env });
    const otherArchive = await archiveCpanPackage({ packageRoot: otherPackage, outputRoot: join(working, "archives") });
    await installCpanArchive({ archive: otherArchive.path, workingRoot: working, prefix, perl, mode: "prebuilt-only", environment: prebuiltEnv });
    prebuiltEnv.LEAN_BRIDGE_PERL_OTHER = "1";
		const consumer = await run(perl, [join(root, "tests/fixtures/perl/consumer.t")], working, prebuiltEnv);
    assert.match(consumer.stdout, /1\.\.\d+\s*$/); assert.doesNotMatch(consumer.stdout, /^not ok/m);
		t.diagnostic(consumer.stdout.trim().split("\n").at(-1));
    const example = await run(perl, [join(root, "tests/fixtures/documentation/consumers/perl/consumer.pl")], working, prebuiltEnv);
    assert.equal(example.stdout, "42\n42\n42\n41\n", "documented prepared consumer executes unchanged");
    const noLean = join(working, "no-lean"); await mkdir(noLean);
    for(const name of ["lean", "lake", "node"])
{
      await copyFile(join(root, "tests/fixtures/perl/deny-tool.sh"), join(noLean, name)); await chmod(join(noLean, name), 0o755);
}
    const fallbackEnv = { ...env, PATH: `${noLean}:${process.env.PATH}`, PERL5LIB: `${join(fallback, "lib/perl5")}:${env.PERL5LIB}` };
    await installCpanArchive({ archive: runtimeArchive.path, workingRoot: working, prefix: fallback, perl, mode: "build-xs", environment: fallbackEnv });
    await installCpanArchive({ archive: archive.path, workingRoot: working, prefix: fallback, perl, mode: "build-xs", environment: fallbackEnv });
    const rebuilt = await run(perl, [join(root, "tests/fixtures/perl/consumer.t")], working, fallbackEnv);
    assert.doesNotMatch(rebuilt.stdout, /^not ok/m);
    const abi = await run(perl, ["-MConfig", "-e", "print $Config{archname}"], working);
    const installedRoot = join(fallback, "lib/perl5", abi.stdout);
    const installReceipt = JSON.parse(await readFile(join(installedRoot, "LeanBridge/Workshop/install-receipt.json"), "utf8"));
		assert.equal(installReceipt.operation, "generated-xs-only");
    assert.equal((await traceCpanInstall({ packageRoot: componentPackage, installRoot: installedRoot })).nativePayloadUnchanged, true);
    assert.ok(installReceipt.commands.length >= 2);
    assert.equal(installReceipt.commands.find(command => command.includes("-c")).filter(flag => /^-g/.test(flag)).at(-1), "-g0");
    assert.equal(sha256(await readFile(join(installedRoot, "LeanBridge/Workshop/native", built.receipt.library))), built.receipt.nativeLibrary.sha256);
    const autoPackage = join(packages, "auto-component");
    await cp(componentPackage, autoPackage, { recursive: true });
    const autoManifest = JSON.parse(await readFile(join(autoPackage, "lean-bridge-package.json"), "utf8"));
    autoManifest.prebuilt = [];
    await writeFile(join(autoPackage, "lean-bridge-package.json"), JSON.stringify(autoManifest));
    const autoArchive = await archiveCpanPackage({ packageRoot: autoPackage, outputRoot: join(working, "auto-archives") });
    await installCpanArchive({ archive: autoArchive.path, workingRoot: working, prefix: fallback, perl, mode: "auto", environment: fallbackEnv });
    assert.equal((await run(perl, ["-MLeanBridge::Workshop", "-e", "print LeanBridge::Workshop::add(19,23)"], working, fallbackEnv)).stdout, "42");
    const repeat = await archiveCpanPackage({ packageRoot: componentPackage, outputRoot: join(working, "repeat") });
    assert.equal(repeat.receipt.sha256, archive.receipt.sha256);
    const independent = await buildNativeComponent({ projectRoot: join(root, "tests/fixtures/perl/ordinary")
    , outputRoot: join(working, "independent-native")
      , runtimeRoot, leanPrefix, resources: ["Workshop.Counter"]
      , arities: { "Workshop.makeAdder": 1, "Workshop.keepCallback": 1, "Workshop.newRunner": 1 } });
    assert.deepEqual(independent.receipt, built.receipt, "independent native build has identical checked outputs");
    // The loader must reject conflicting module identities before loading ELF code.
    await assert.rejects(run(perl, ["-MLeanBridge::Workshop"
    , "-MLeanBridge::Runtime"
    , "-e"
      , 'LeanBridge::Runtime::_load_component($INC{"LeanBridge/Workshop.pm"}, "unused.so", "unused", LeanBridge::Runtime::_identity(), { Workshop => "different" })'], working, env),
    error => /Conflicting compiled Lean module/.test(errorText(error)));

    for(const [label, mutate, mode, pattern, testEnv] of [
      ["missing-prebuilt", manifest => { manifest.prebuilt = []; }, "prebuilt-only", /No compatible prebuilt/, env]
      , ["missing-compiler", manifest => { manifest.prebuilt = []; }, "auto", /compiler unavailable/, prebuiltEnv]
      , ["invalid-mode", () => {}, "unknown", /must be auto/, env]
      , ["incompatible-platform", manifest => { manifest.glibcMinimumVersion = "2.999"; }, "auto", /requires glibc/, env]
      , ["incompatible-abi", manifest => { manifest.prebuilt[0].abiKey = "0".repeat(64); }, "prebuilt-only", /No compatible prebuilt/, env]
      , ["incompatible-runtime", manifest => { manifest.runtimeIdentity = "0".repeat(64); }, "auto", /Incompatible shared Lean runtime/, env]
    ]) {
      const directory = join(working, label); await cp(componentPackage, directory, { recursive: true });
      const manifest = JSON.parse(await readFile(join(directory, "lean-bridge-package.json"), "utf8"));
      mutate(manifest); await writeFile(join(directory, "lean-bridge-package.json"), JSON.stringify(manifest));
      await assert.rejects(run(perl, ["Makefile.PL"], directory, { ...testEnv, LEAN_BRIDGE_PERL_INSTALL_MODE: mode }), error => pattern.test(errorText(error)), label);
    }
    const corrupt = join(working, "corrupt"); await cp(componentPackage, corrupt, { recursive: true });
    const corruptManifest = JSON.parse(await readFile(join(corrupt, "lean-bridge-package.json"), "utf8"));
    await writeFile(join(corrupt, corruptManifest.prebuilt[0].path), "corrupt");
    await assert.rejects(run(perl, ["Makefile.PL"], corrupt, env), error => /Corrupt package artifact/.test(errorText(error)));
		assert.ok(!(await readdir(corrupt)).includes("_xs-build"), "corruption must not trigger fallback");
    if(process.env.LEAN_BRIDGE_PERL_BENCHMARK_DIR)
{
      const report = await benchmarkPerl({ nativeRoot, runtimeRoot, prefix, perl, leanPrefix, outputRoot: process.env.LEAN_BRIDGE_PERL_BENCHMARK_DIR });
      assert.equal(report.nativeLibrarySha256, built.receipt.nativeLibrary.sha256);
      for(const item of Object.values(report.cases)) assert.ok(Number.isFinite(item.relativeCost) && item.relativeCost > 0);
      await writeFile(join(process.env.LEAN_BRIDGE_PERL_BENCHMARK_DIR, "acceptance.json"), JSON.stringify({
        schemaVersion: 1
        , perl
        , glibcMinimumVersion: floor
        , nativeLibrarySha256: built.receipt.nativeLibrary.sha256
        , packages: [runtimeArchive.receipt, archive.receipt, otherArchive.receipt]
      }, null, 2) + "\n");
}
} catch(error)
{
    t.diagnostic(errorText(error));
    throw error;
} finally
{
    if(process.env.LEAN_BRIDGE_KEEP_PERL_TEST === "1") t.diagnostic(`Perl test artifacts: ${working}`);
    else await rm(working, { recursive: true, force: true });
}
});

test("fresh Lean metadata rejects unsupported or unreviewed exports before releasing native output", { skip: !enabled, timeout: 180_000 }, async () => {
	const working = await mkdtemp(join(root, "build/.perl-rejection-test-"));
	try
	{
		const runtimeRoot = join(working, "runtime");
		await buildNativeSharedRuntime({ outputRoot: runtimeRoot, leanPrefix });
		for(const [name, pattern, resources] of [
			["loop", /partial/, []]
			, ["viaLoop", /partial/, []]
			, ["admitted", /admitted-implementation/, []]
			, ["dependent", /dependent or implicit/, []]
			, ["polymorphic", /specialization-required/, []]
			, ["viaForeign", /foreign implementation contract/, []]
			, ["echoTiny", /no stable heap identity/, ["Rejections.Tiny"]]
		]) {
			await assert.rejects(buildNativeComponent({
				projectRoot: join(root, "tests/fixtures/perl/rejected")
				, outputRoot: join(working, name)
				, runtimeRoot
				, leanPrefix
				, modules: ["Rejections"]
				, exports: [`Rejections.${name}`]
				, resources
			}), error => pattern.test(errorText(error)), name);
			assert.ok(!(await readdir(working)).includes(name), `${name}: no rejected release remains`);
		}
	} finally
	{
		await rm(working, { recursive: true, force: true });
	}
});
