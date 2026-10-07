/**
 * Closed generic structures named by an alias: compiler provenance, npm and C-family acceptance, and rejections.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { buildCanonicalProject } from "../src/build/canonical-build.mjs";
import { executeComponentEngineRequest } from "../src/build/component-engine.mjs";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { validateNativeType } from "../src/analyze/native-types.mjs";
import { createNativeModel } from "../src/build/native-model.mjs";
import "./helpers/generic-records-source-history-tests.mjs";
import { createElaboratedSemanticModel, elaboratedComponent } from "../src/analyze/semantic-model.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { verifyPackageSetReceipt } from "../src/release/package-set-receipt.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { copyPackageSetHandoff } from "./helpers/package-set.mjs";
import { prepareRustCorpusDependencies } from "./helpers/type-corpus-rust.mjs";
import { genericRecordRustDiagnostics } from "./helpers/generic-record-rust.mjs";
import { genericRecordDotnetDiagnostics } from "./helpers/generic-record-managed-types.mjs";
import { assertGenericRecordIr, checkGenericRecordNpmPackages, genericRecordEnvironment, genericRecordExports, genericRecordInstantiations, genericRecordProvenanceOnly, genericRecordSource, genericRecordTargets, installGenericRecordConsumer } from "./helpers/generic-record-packages.mjs";

const wasm = process.env.LEAN_BRIDGE_LAKE_WASM_TEST === "1";
const profiles = process.env.LEAN_BRIDGE_GENERIC_RECORD_PROFILES?.split(",").sort() ?? [];
assert.ok(profiles.every(profile => Object.hasOwn(genericRecordTargets, profile)), "Unknown generic record profile");
assert.equal(new Set(profiles).size, profiles.length, "Duplicate generic record profile");
const engineRoot = process.cwd();
const runtimeRoot = resolve(process.env.LEAN_BRIDGE_LAKE_RUNTIME_ROOT ?? "build/lean-link-spike/lazy");
const environment = { ...process.env, LEAN_BRIDGE_BUILD_BACKEND: "nix", LEAN_BRIDGE_RUNTIME_ROOT: runtimeRoot };
const fixture = async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-records-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp("tests/fixtures/documentation/lean-author", root, { recursive: true });
	return { directory, root };
};
// Only the Nix command transport is substituted; the pinned engine executes in-process.
const transport = () => ({ capture: async command => {
	if(command.command === "docker") throw new Error("Docker is absent in the injected transport");
	if(command.args[0] === "--version") return { stdout: "nix (Nix) 2.24.11", stderr: "", code: 0 };
	const arg = flag => command.args[command.args.indexOf(flag) + 1];
	await executeComponentEngineRequest({ requestPath: arg("--request"), inputRoot: arg("--component"), outputRoot: arg("--output"), engineRoot: arg("--engine"), backend: "native-nix" });
	return { stdout: "", stderr: "", code: 0 };
} });
const build = (root, outputRoot) => buildCanonicalProject({ projectRoot: root, outputRoot, engineRoot, environment, targets: ["npm"], runner: transport() });

const heap = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
const nat = { kind: "primitive", name: "nat", lean: "Nat", abi: { ...heap, heap: false } };
const text = { kind: "primitive", name: "string", lean: "String", abi: heap };
const record = (name, structure, args, fields) => ({ kind: "record", name, lean: name, constructor: `${structure ?? name}.mk`, ...(structure ? { provenance: { structure, arguments: args } } : {}), fields, abi: heap });
const field = (name, type) => ({ name, projection: `Sample.Box.${name}`, type });
const digit = { kind: "refinement", base: nat, predicate: { kind: "fin", bound: "10" }, abi: nat.abi };

test("native types accept an alias-named instantiation with closed provenance and refuse malformed origins", () => {
	const box = record("Sample.NatBox", "Sample.Box", [nat], [field("value", nat), field("count", nat)]);
	validateNativeType(box);
	validateNativeType(record("Sample.MaybeBox", "Sample.Box", [{ kind: "option", element: nat, abi: heap }], [field("value", { kind: "option", element: nat, abi: heap }), field("count", nat)]));
	// Inline form: a nominal argument is the inline definition, as it is in a field.
	validateNativeType(record("Sample.BoxPair", "Sample.Pair", [box, text], [field("first", box), field("second", text)]));
	// A phantom argument: the definition travels only through the provenance.
	validateNativeType(record("Sample.MarkerTag", "Sample.Tag", [record("Sample.Marker", undefined, undefined, [field("id", nat)])], [field("label", text)]));
	// Graph form: arguments are references into the table, like field types.
	const boxReference = { kind: "reference", name: "Sample.NatBox", lean: "Sample.NatBox", abi: heap };
	const tablePair = record("Sample.BoxPair", "Sample.Pair", [boxReference, text], [field("first", boxReference), field("second", text)]);
	validateNativeType({ kind: "graph", root: { ...boxReference, name: "Sample.BoxPair", lean: "Sample.BoxPair" }, abi: heap, types: [box, tablePair] });
	const invalid = [
		["structure equal to the alias", { ...box, provenance: { structure: "Sample.NatBox", arguments: [nat] } }]
		, ["constructor outside the structure", { ...box, constructor: "Sample.Other.mk" }]
		, ["no arguments", { ...box, provenance: { structure: "Sample.Box", arguments: [] } }]
		, ["open provenance fields", { ...box, provenance: { structure: "Sample.Box", arguments: [nat], extra: true } }]
		, ["a callback argument", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "callback", parameters: [nat], result: nat, abi: heap }] } }]
		, ["an unnamed reference", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "reference", name: "Sample.NatBox", lean: "Other", abi: heap }] } }]
		// Descriptor representations are checked like every type's, not only closed.
		, ["a malformed reference representation", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "reference", name: "Sample.NatBox", lean: "Sample.NatBox", abi: { malformed: true } }] } }]
		, ["an open container representation", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "option", element: nat, abi: { ...heap, extra: 1 } }] } }]
		, ["an inconsistent container representation", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "list", element: nat, abi: { ...heap, box: "lean_box_uint32" } }] } }]
		, ["a scalar tuple representation", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "tuple", arguments: [nat, nat], abi: { cType: "uint32_t", box: "lean_box_uint32", unbox: "lean_unbox_uint32", heap: true } }] } }]
		, ["a missing primitive representation", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "primitive", name: "nat", lean: "Nat" }] } }]
		// A refinement anywhere inside an argument would lower away its bound.
		, ["a refined argument inside an option", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "option", element: digit, abi: heap }] } }]
		, ["a refined argument behind an alias", { ...box, provenance: { structure: "Sample.Box", arguments: [{ kind: "alias", name: "Sample.Digit", lean: "Sample.Digit", target: digit, abi: nat.abi }] } }]
		, ["a refined field of a nominal argument", { ...box, provenance: { structure: "Sample.Box", arguments: [record("Sample.Digits", undefined, undefined, [field("value", { kind: "list", element: digit, abi: heap })])] } }]];
	for(const [label, type] of invalid) assert.throws(() => validateNativeType(type), /native-library-v1/, label);
	assert.equal(Object.keys(genericRecordInstantiations).length, 8);
});

// Synthetic native metadata whose first declaration takes the first record and returns the second.
const withRecord = (parameter, result = parameter) => {
	const input = { ...nativeMetadataFixture(), component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	const declaration = input.metadata.modules[0].declarations[0];
	declaration.projection.parameters[0].type = parameter; declaration.projection.result = result;
	return input;
};

test("provenance arguments carry their definitions, dangling references and conflicting origins are refused", () => {
	const box = record("Sample.NatBox", "Sample.Box", [nat], [field("value", nat), field("count", nat)]);
	const pair = record("Sample.BoxPair", "Sample.Pair", [box, text], [field("first", box), field("second", text)]);
	createNativeModel(withRecord(pair));
	// A phantom argument carries the definition only the instantiation names: the Binding IR defines it, the transport does not.
	const marker = record("Sample.Marker", undefined, undefined, [field("id", nat)]);
	const phantom = record("Sample.MarkerTag", "Sample.Tag", [marker], [field("label", text)]);
	const phantomModel = createNativeModel(withRecord(phantom));
	assert.ok(phantomModel.bindingIr.types.some(type => type.id === "lean:Sample.Marker" && type.kind === "record"));
	assert.ok(!phantomModel.types.some(type => type.name === "Sample.Marker"));
	// A reference that no table defines binds to nothing, in the inline form and in a graph.
	const reference = { kind: "reference", name: "Sample.Missing", lean: "Sample.Missing", abi: heap };
	const dangling = record("Sample.Tagged", "Sample.Tag", [reference], [field("count", nat)]);
	assert.throws(() => createNativeModel(withRecord(dangling)), /reference requires a matching nominal definition/u);
	assert.throws(() => createNativeModel(withRecord({ kind: "graph", root: { ...reference, name: "Sample.Tagged", lean: "Sample.Tagged" }, types: [dangling], abi: heap })), /reference requires a matching nominal definition/u);
	// An argument definition that disagrees with the same definition carried by a field is a conflict, never a silent merge.
	const disagreeing = record("Sample.BoxPair", "Sample.Pair", [{ ...box, fields: [field("value", text), field("count", nat)] }, text], [field("first", box), field("second", text)]);
	assert.throws(() => createNativeModel(withRecord(disagreeing)), /Conflicting compiler type definitions: lean:Sample\.NatBox/u);
	// The same alias with two different origins is a conflicting definition too.
	const drifted = record("Sample.NatBox", "Sample.Crate", [nat], [field("value", nat), field("count", nat)]);
	const input = withRecord(box, drifted);
	assert.throws(() => createElaboratedSemanticModel({ metadata: input.metadata, request: input.sourceIdentity.request, component: elaboratedComponent({ name: "Sample", version: "1.0.0" }), elaborationSha256: "9".repeat(64) }), /Conflicting compiler type definitions: lean:Sample\.NatBox/u);
	// Lowering keeps the origin as a source extension with canonical references, not full shapes.
	const model = createElaboratedSemanticModel({ metadata: withRecord(pair).metadata, request: withRecord(pair).sourceIdentity.request, component: elaboratedComponent({ name: "Sample", version: "1.0.0" }), elaborationSha256: "9".repeat(64) });
	const lowered = model.document.types.find(type => type.id === "lean:Sample.BoxPair");
	assert.deepEqual(lowered.source.extensions["lean-lang.org/instantiation"], { structure: "Sample.Pair", arguments: [{ kind: "named", id: "lean:Sample.NatBox" }, { kind: "primitive", name: "string" }] });
	assert.equal(model.document.types.find(type => type.id === "lean:Sample.NatBox").source.extensions["lean-lang.org/instantiation"].structure, "Sample.Box");
});

// Synthetic component-profile metadata: a phantom argument whose option carries a Fin bound.
const componentTag = (bound, graph = false) => {
	const input = { ...nativeMetadataFixture(), component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	const { metadata, sourceIdentity } = input;
	metadata.profile = "component-scalars-v1"; sourceIdentity.request.profile = "component-scalars-v1"; sourceIdentity.request.metadata.profile = "component-scalars-v1";
	const declaration = metadata.modules[0].declarations[0];
	const fin = bound === null ? { kind: "primitive", name: "nat" } : { kind: "refinement", base: { kind: "primitive", name: "nat" }, predicate: { kind: "fin", bound } };
	const label = [{ name: "label", type: { kind: "primitive", name: "string" } }];
	// Inline: the option of the bound is the argument. Graph: the argument references a table record whose field carries it.
	const digitTag = { kind: "record", name: "Sample.DigitTag", provenance: { structure: "Sample.Tag", arguments: [{ kind: "reference", name: "Sample.Digits" }] }, fields: label };
	const digits = { kind: "record", name: "Sample.Digits", fields: [{ name: "value", type: { kind: "list", element: fin } }] };
	const tag = graph
		? { kind: "graph", root: { kind: "reference", name: "Sample.DigitTag" }, types: [digitTag, digits] }
		: { kind: "record", name: "Sample.DigitTag", provenance: { structure: "Sample.Tag", arguments: [{ kind: "option", element: fin }] }, fields: label };
	declaration.projection.bindingShape = "pure-function";
	declaration.projection.parameters[0].type = tag; declaration.projection.result = tag;
	return { metadata, request: sourceIdentity.request };
};

test("component metadata refuses a refined provenance argument instead of lowering its bound away", () => {
	// The same shapes without the bound lower, so only the refinement is refused.
	for(const graph of [false, true])
	{
		const { metadata, request } = componentTag(null, graph);
		const lowered = createElaboratedSemanticModel({ metadata, request, component: elaboratedComponent({ name: "Sample", version: "1.0.0" }), elaborationSha256: "9".repeat(64) });
		assert.ok(lowered.document.types.some(type => type.id === "lean:Sample.DigitTag" && type.source.extensions["lean-lang.org/instantiation"]), String(graph));
	}
	for(const [bound, graph] of [["5", false], ["10", false], ["10", true]])
	{
		const { metadata, request } = componentTag(bound, graph);
		assert.throws(() => createElaboratedSemanticModel({ metadata, request, component: elaboratedComponent({ name: "Sample", version: "1.0.0" }), elaborationSha256: "9".repeat(64) })
			, /Component record provenance arguments cannot carry resource, callback or refinement types/u, `${bound} ${graph}`);
	}
});

test("installed npm packages carry alias-named generic records with their instantiation provenance", { skip: !wasm, timeout: 3_600_000 }, async t => {
	const observation = await checkGenericRecordNpmPackages(t, { fixture, build, runtimeRoot, engineRoot });
	const reportPath = resolve(process.env.LEAN_BRIDGE_GENERIC_RECORD_NPM_REPORT ?? "build/generic-records/npm.json");
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, profile: "npm", ...observation }));
});

// A phantom argument that carries a Fin bound: the npm profile admits nested Fin, so only the argument rule refuses it.
const refinedPhantom = "abbrev DigitTag := Tag (Option (Fin 10))\ndef digitTagged (value : DigitTag) : String := value.label";

test("an unaliased instantiation and a refined phantom argument stop an npm build with a classified hint", { skip: !wasm, timeout: 3_600_000 }, async t => {
	for(const [name, extra] of [["swap", ""], ["digitTagged", refinedPhantom]]) await t.test(name, async t => {
		const { directory, root } = await fixture(t);
		await saveLakeFile(root, "OnboardingSmall.lean", (await genericRecordSource("OnboardingSmall")).replace("end OnboardingSmall", `${extra}\nend OnboardingSmall`));
		await saveLakeFile(root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["OnboardingSmall"], exports: [`OnboardingSmall.${name}`] }));
		const outputRoot = join(directory, "build");
		await assert.rejects(() => build(root, outputRoot), error => {
			assert.deepEqual(error.details?.hints, [`hint:OnboardingSmall.${name}:unsupported-parameter-type`]);
			return true;
		});
		await assert.rejects(() => access(join(outputRoot, "bundle")));
	});
});

test("generic structure instantiations are rejected at the Lean source unless an abbrev names a closed, copied application", { skip: !profiles.includes("c"), timeout: 1_800_000 }, async t => {
	const cases = [
		["an unaliased application in a result", ["swap"], "", /name this instantiation of a generic structure with an abbrev: GenericRecords\.Pair Nat String/]
		, ["an unaliased application as an argument", ["nested"], "abbrev Nested := Box (Box Nat)\ndef nested (value : Nested) : Nat := value.value.value", /name this instantiation of a generic structure with an abbrev: GenericRecords\.Box Nat/]
		, ["an inherited structure", ["named"], "structure Named (α : Type) extends Box α where\n  name : String\nabbrev NamedNat := Named Nat\ndef named (value : NamedNat) : Nat := value.value", /inherited generic records require a reviewed projection/]
		, ["a field that depends on the value", ["sized"], "structure Sized (α : Type) where\n  items : List α\n  ok : items.length < 10\nabbrev SizedNat := Sized Nat\ndef sized (value : SizedNat) : Nat := value.items.length", /generic record field ok depends on the record value/]
		, ["a callback argument", ["applied"], "abbrev FnBox := Box (Nat → Nat)\ndef applied (value : FnBox) : Nat := value.value value.count", /callbacks inside copied values require a retention policy/]
		// The native profile checks Fin only at structural positions, so the argument's bound is refused before the argument rule.
		, ["a refined phantom argument", ["digitTagged"], refinedPhantom, /Fin refinements are not implemented by the native-library profile outside top-level parameters, results and their arrays, lists and options/]];
	for(const [label, names, extra, pattern] of cases) await t.test(label, async t => {
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-records-reject-"));
		t.after(() => rm(directory, { recursive: true, force: true }));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
		await cp("tests/fixtures/onboarding/generic-records", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "GenericRecords.lean", (await genericRecordSource()).replace("end GenericRecords", `${extra}\nend GenericRecords`));
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["GenericRecords"], exports: names.map(name => `GenericRecords.${name}`), targets: Object.fromEntries([genericRecordTargets.c]) }));
		// The rejection is classified and names the declaration, module and the offending type.
		await assert.rejects(() => buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: genericRecordEnvironment(["c"]) }), error => {
			assert.equal(error.code, "native-elaboration-unsupported", label);
			assert.deepEqual(error.details.diagnostics.map(item => [item.code, item.module, item.declaration, item.severity]), [["unsupported-native-type", "GenericRecords", `GenericRecords.${names[0]}`, "error"]], label);
			assert.match(error.details.projections[0].expression, pattern, label);
			return true;
		});
		await assert.rejects(() => access(outputRoot));
	});
});

// Established structural constructors are Lean structures too; their mappings stay ahead of generic-record admission.
const structuralControls = `
abbrev Pairish := Nat × String
abbrev Nums := Array Nat
abbrev Names := List String
abbrev MaybeNat := Option Nat
abbrev Outcome := Except String Nat
def tupleDirect (value : Nat × String) : Nat × String := (value.1 + 1, value.2)
def tupleAlias (value : Pairish) : Pairish := (value.1 + 1, value.2)
def arrayDirect (value : Array Nat) : Array Nat := value.push 1
def arrayAlias (value : Nums) : Nums := value.push 1
def listDirect (value : List String) : List String := value.reverse
def listAlias (value : Names) : Names := value.reverse
def optionDirect (value : Option Nat) : Option Nat := value.map (· + 1)
def optionAlias (value : MaybeNat) : MaybeNat := value.map (· + 1)
def exceptDirect (value : Except String Nat) : Except String Nat := value
def exceptAlias (value : Outcome) : Outcome := value
`;

test("direct and aliased Array, List, Option, Prod and Except keep their metadata shapes beside alias-named records", { skip: !profiles.includes("c"), timeout: 1_800_000 }, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-records-controls-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project"), outputRoot = join(directory, "release");
	await cp("tests/fixtures/onboarding/generic-records", projectRoot, { recursive: true });
	await saveLakeFile(projectRoot, "GenericRecords.lean", (await genericRecordSource()).replace("end GenericRecords", `${structuralControls}\nend GenericRecords`));
	const controls = ["tupleDirect", "tupleAlias", "arrayDirect", "arrayAlias", "listDirect", "listAlias", "optionDirect", "optionAlias", "exceptDirect", "exceptAlias"];
	const exports = [...genericRecordExports, ...controls.map(name => `GenericRecords.${name}`)];
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["GenericRecords"], exports, targets: Object.fromEntries([genericRecordTargets.c]) }));
	await buildCanonicalProject({ projectRoot, outputRoot, targets: ["c"], environment: genericRecordEnvironment(["c"]) }).catch(error => assert.fail(`${error.message}: ${JSON.stringify(error.details)}`));
	const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
	// The Binding IR keeps alias names as definitions; the native transport resolves them to their targets.
	const ir = model.bindingIr, definitions = new Map(ir.types.map(type => [type.id, type]));
	const shape = type => type.kind === "named" ? definition(definitions.get(type.id)) : type.kind === "apply" ? `${type.constructor}(${type.arguments.map(shape).join(",")})` : type.name;
	const definition = type => type.kind === "alias" ? `${type.id.split(".").at(-1)}=${shape(type.target)}` : `${type.kind}:${type.id.split(".").at(-1)}`;
	const signature = name => { const item = ir.declarations.find(item => item.source.declaration === `GenericRecords.${name}`); return `${item.parameters.map(parameter => shape(parameter.type)).join(", ")} -> ${shape(item.result.type)}`; };
	assert.equal(signature("bump"), "record:NatBox -> record:NatBox");
	// The controls define no record and carry no instantiation; the alias-named records are unchanged beside them.
	assert.deepEqual(ir.types.filter(type => type.kind === "record").map(type => type.id).sort(), [...Object.keys(genericRecordInstantiations), ...genericRecordProvenanceOnly].map(name => `lean:GenericRecords.${name}`).sort());
	assertGenericRecordIr(ir, "GenericRecords");
	// The native transport resolves the aliases to their targets and keeps the tuple and result shapes.
	const transport = type => type.element ? `${type.kind}(${transport(type.element)})` : type.arguments ? `${type.kind}(${type.arguments.map(transport).join(",")})` : type.name;
	assert.equal(transport(model.exports.find(item => item.name === "GenericRecords.tupleAlias").parameters[0].type), "tuple(nat,string)");
	assert.equal(transport(model.exports.find(item => item.name === "GenericRecords.exceptAlias").result), "result(nat,string)");
});

// Every native profile the harness can select has its own consumer and package coordinate.
test("Rust generic-record rejection reports require exact caller type errors", () => {
	const message = { reason: "compiler-message", message: { level: "error", code: { code: "E0308" }, spans: [{ is_primary: true, file_name: "invalid-alias.rs", line_start: 2, column_start: 70 }] } };
	const result = { code: 101, stdout: JSON.stringify(message) + "\n", stderr: "" };
	assert.deepEqual(genericRecordRustDiagnostics(result, "invalid-alias.rs", "E0308"), [{ code: "E0308", file: "invalid-alias.rs", line: 2, column: 70 }]);
	for(const changed of [{ ...result, code: 0 }, { ...result, stdout: "" }, { ...result, stdout: "not JSON" }])
		assert.throws(() => genericRecordRustDiagnostics(changed, "invalid-alias.rs", "E0308"));
	for(const change of [value => { value.message.code.code = "E0433"; }, value => { value.message.spans[0].file_name = "dependency/lib.rs"; }, value => { value.message.spans[0].is_primary = false; }])
	{
		const changed = structuredClone(message); change(changed);
		assert.throws(() => genericRecordRustDiagnostics({ ...result, stdout: JSON.stringify(changed) }, "invalid-alias.rs", "E0308"));
	}
});

const consumerExtensions = { c: "c", cpp: "cpp", python: "py", rust: "rs", perl: "pl", ruby: "rb", dotnet: "cs", java: "java", kotlin: "kt", "php-native": "php", "wit-wasi": "c" };

test("C# generic-record rejection reports require exact caller type errors", () => {
	const result = { code: 1, stdout: "invalid-alias.cs(1,70): error CS1503: Argument type mismatch\n", stderr: "" };
	assert.deepEqual(genericRecordDotnetDiagnostics(result, "/consumer", "invalid-alias.cs", "CS1503"), [{ code: "CS1503", file: "invalid-alias.cs", line: 1, column: 70 }]);
	for(const changed of [
		{ ...result, code: 0 }, { ...result, stdout: "" }
		, { ...result, stdout: result.stdout.replace("CS1503", "CS0006") }
		, { ...result, stdout: result.stdout.replace("invalid-alias.cs", "dependency.cs") }
		, { ...result, stdout: result.stdout.replace("(1,70)", "(0,70)") }
		, { ...result, stderr: "error: unrelated compiler failure" }])
		assert.throws(() => genericRecordDotnetDiagnostics(changed, "/consumer", "invalid-alias.cs", "CS1503"));
});

test("every native profile has a generic record consumer and a target", async () => {
	assert.deepEqual(Object.keys(genericRecordTargets).sort(), Object.keys(consumerExtensions).sort());
	for(const profile of profiles) assert.ok(profile in genericRecordTargets, profile);
	for(const [profile, extension] of Object.entries(consumerExtensions)) await access(`tests/fixtures/generic-record-consumers/${profile}.${extension}`);
});

test("relocated source-free native packages construct and project alias-named generic records", { skip: !profiles.length, timeout: 2_400_000 }, async t => {
	const reports = [], archives = [];
	const targets = Object.fromEntries(profiles.map(profile => genericRecordTargets[profile]));
	const environment = genericRecordEnvironment(profiles);
	// CI exports the Ruby toolchain; local runs use the pinned MRI 3.3 beside the other toolchains.
	if(profiles.includes("ruby"))
	{
		environment.LEAN_BRIDGE_RUBY ??= resolve(".toolchains/ruby33/bin/ruby");
		environment.LEAN_BRIDGE_GEM ??= join(dirname(environment.LEAN_BRIDGE_RUBY), "gem");
	}
	for(const attempt of [0, 1])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-records-author-"));
		const consumer = await mkdtemp(join(tmpdir(), "lean-bridge-generic-records-consumer-"));
		t.after(() => Promise.all([directory, consumer].map(root => rm(root, { recursive: true, force: true }))));
		const projectRoot = join(directory, "project"), outputRoot = join(directory, "release"), handoff = join(consumer, "handoff");
		await cp("tests/fixtures/onboarding/generic-records", projectRoot, { recursive: true });
		await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["GenericRecords"], exports: genericRecordExports, targets }));
		t.diagnostic(`build ${attempt}: ${profiles.join(", ")}`);
		const built = await buildCanonicalProject({ projectRoot, outputRoot, targets: Object.keys(targets), environment }).catch(error => {
			error.message += `: ${JSON.stringify(error.details)}`; throw error;
		});
		const model = JSON.parse(await readFile(join(outputRoot, "native/component/model.json"), "utf8"));
		// The native model keeps each alias-named record with its structure and resolved arguments.
		const records = model.types.filter(type => type.kind === "record");
		assert.deepEqual(records.map(type => type.name).sort(), Object.keys(genericRecordInstantiations).map(name => `GenericRecords.${name}`).sort());
		for(const type of records) assert.equal(type.provenance.structure, `GenericRecords.${genericRecordInstantiations[type.name.split(".").at(-1)].structure}`, type.name);
		// A definition only a provenance names is not a transport type; the Binding IR carries it.
		assert.ok(!model.types.some(type => type.name === "GenericRecords.Marker"));
		assertGenericRecordIr(model.bindingIr, "GenericRecords");
		const receipt = await copyPackageSetHandoff(outputRoot, handoff);
		await verifyPackageSetReceipt({ receiptPath: join(handoff, "package-set-receipt.json") });
		archives.push(Object.fromEntries(receipt.packages.flatMap(pkg => pkg.artifacts.map(artifact => [artifact.path, artifact.sha256]))));
		const dependencies = attempt === 0 && profiles.includes("rust")
			? await prepareRustCorpusDependencies({ rustRoot: join(outputRoot, "native/rust"), directory, handoff: join(consumer, "dependencies"), environment }) : undefined;
		// Install from prepared archives only. No author workspace or build staging remains.
		await rm(directory, { recursive: true, force: true });
		if(attempt === 1) break;
		for(const profile of profiles)
		{
			t.diagnostic(`installing and checking ${profile}`);
			const target = genericRecordTargets[profile][0];
			const packages = receipt.packages.filter(pkg => pkg.target === target);
			const { command, ...observation } = await installGenericRecordConsumer({ profile, consumer, handoff, packages, dependencies, environment });
			void command;
			reports.push({ profile, path: "ordinary-source", ...observation, packages
				, instantiations: genericRecordInstantiations
				, bindingIrSha256: built.bindingIrSha256
				, sourceTreeSha256: model.sourceIdentity.sourceTreeSha256
				, modelSha256: sha256(canonicalJson(model))
				, receiptSha256: sha256(await readFile(join(handoff, "package-set-receipt.json")))
				, sourceRemovedBeforeInstallation: true });
			await rm(join(consumer, profile), { recursive: true, force: true });
		}
		await rm(consumer, { recursive: true, force: true });
	}
	assert.deepEqual(archives[1], archives[0]);
	const reportPath = resolve(process.env.LEAN_BRIDGE_GENERIC_RECORD_REPORT ?? `build/generic-records/${profiles.join("-")}.json`);
	await saveLakeFile(dirname(reportPath), reportPath.split("/").at(-1), canonicalJson({ schemaVersion: 1, reports, archives: archives[0], reproducible: true }));
});
