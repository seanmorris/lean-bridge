/**
 * Exercise compiler-owned metadata without executing a target ABI or package initializer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { access, chmod, cp, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { createMetadataRequest, identifyLeanInterface, validateElaboratedMetadata } from "../src/analyze/elaborated-metadata.mjs";
import { projectElaboratedMetadata } from "../src/analyze/project-elaborated.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { canonicalJson } from "../src/capsule/node.mjs";
import { lakeWorkspaceFixture, lakeInputState, saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

const enabled = process.env.LEAN_BRIDGE_ELABORATED_METADATA_TEST === "1";
const engineRoot = process.cwd();
const leanPrefix = async () => (await processBuildRunner.capture({ command: join(engineRoot, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: engineRoot })).stdout.trim();
const sample = () => {
	const selection = { modules: ["Sample"], exportModules: ["Sample"], exports: ["Sample.keep"], resources: [], arities: [] };
	const source = { name: "Sample", sourcePath: "root/Sample.lean", sourceSha256: "a".repeat(64), interfaceSha256: "b".repeat(64) };
	const request = createMetadataRequest(selection, { toolchain: "leanprover/lean4:v4.32.2", modules: [source], leanCompilerSha256: "c".repeat(64), extractorSha256: "d".repeat(64) });
	const type = { kind: "primitive", name: "uint32" };
	const declaration = { identity: "Sample.keep"
		, kind: "definition"
		, visibility: "public"
		, selected: true
		, source: { path: source.sourcePath, startLine: 1, startColumn: 0, endLine: 1, endColumn: 43 }
		, documentation: "Keep the value."
		, typeExpression: "UInt32 → UInt32"
		, parameters: [{ name: "value", binderInfo: "explicit", typeExpression: "UInt32" }]
		, resultExpression: "UInt32"
		, effects: []
		, theoremReferences: []
		, projection: { status: "supported", bindingShape: "pure-function", parameters: [{ name: "value", type }], result: type } };
	const report = { schemaVersion: 2
		, kind: "lean-bridge-elaborated-exports"
		, profile: "component-scalars-v1"
		, producer: { adapter: "lean-bridge-elaborator", adapterVersion: 2, tool: "Lean", toolVersion: "4.32.2", toolchain: request.metadata.toolchain, invocationIdentitySha256: request.metadata.invocationIdentitySha256 }
		, modules: [{ ...source, directImports: ["Init"], declarations: [declaration] }]
		, diagnostics: [] };
	return { request, report };
};

test("shared compiler report closes fields, context identities, binders and runtime shapes", async () => {
	const { request, report } = sample();
	assert.equal(validateElaboratedMetadata(report, request), true);
	await assertJsonSchema("elaborated-export-metadata", report);
	for(const change of [
		value => { value.extra = true; }
		, value => { value.modules = [null]; }
		, value => { value.modules[0].declarations = [null]; }
		, value => { value.producer.invocationIdentitySha256 = "0".repeat(64); }
		, value => { value.modules[0].sourceSha256 = "0".repeat(64); }
		, value => { value.modules[0].interfaceSha256 = "0".repeat(64); }
		, value => { value.modules[0].directImports.push("Init"); }
		, value => { value.modules[0].declarations.push(value.modules[0].declarations[0]); }
		, value => { value.modules[0].declarations[0].parameters[0].binderInfo = "implicit"; }
		, value => { value.modules[0].declarations[0].projection.result = { kind: "apply", constructor: "array", arguments: [] }; }
		, value => { value.modules[0].declarations[0].source.path = "root/Other.lean"; }
		, value => { value.modules[0].declarations[0].source.endLine = 0; }
	]) {
		const invalid = structuredClone(report); change(invalid);
		assert.throws(() => validateElaboratedMetadata(invalid, request), { code: "invalid-elaborated-metadata" });
	}
});

test("Binding IR uses structural compiler types and never parses rendered expressions", () => {
	const { request, report } = sample();
	const project = { name: "sample", version: "1.0.0", toolchain: request.metadata.toolchain, toolVersion: "4.32.2" };
	const analysis = () => projectElaboratedMetadata({ project, inputs: [], sourceTreeSha256: "e".repeat(64) }, [{ module: "Sample", path: "Sample.lean" }], { request, metadata: report });
	report.modules[0].declarations[0].typeExpression = "Printed text is not an ABI description";
	assert.deepEqual(analysis().bindingIr.document.declarations[0].parameters[0].type, { kind: "primitive", name: "uint32" });
	assert.deepEqual(analysis().bindingIr.document.assurance, []);
});

test("supported metadata must honor contracts and report every unused contract", () => {
	const { request, report } = sample();
	request.contracts = { "Sample.keep": { parameters: [{ ownership: "copy", lifetime: null }], effects: [] } };
	assert.equal(validateElaboratedMetadata(report, request), true);
	request.contracts["Sample.keep"].effects = ["async"];
	assert.throws(() => validateElaboratedMetadata(report, request), /violates its configured export contract/);
	request.contracts = { "Sample.missing": { effects: [] } };
	request.exports = [];
	assert.throws(() => validateElaboratedMetadata(report, request), /unused without a compiler diagnostic/);
});

const inspect = async (context, runner = processBuildRunner, signal) => {
	const intent = await prepareLakeEntryIntent({ projectRoot: context.root });
	const prefix = await leanPrefix();
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(module => module.module), leanPrefix: prefix });
	try
	{
		return await elaborateLakeEntryModules({ inventory: await inspectLeanProject(context.root), entries: intent.document.modules, workspace, leanPrefix: prefix, engineRoot, runner, signal });
	}
	finally
	{ await workspace.dispose(); }
};

test("Lean checks contracts against selected signatures without erasing refinements or effects", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", `namespace Shop
abbrev Word := UInt32
/-- Keep a copied word. -/
def keep (value : Word) : Word := value
def borrowWord (value : Word) : Word := value
def wrongArity (value : Word) : Word := value
def wrongEffects (value : Word) : Word := value
def checkedWord (value : Word) : Word := value
def bounded (value : Fin 5) : Fin 5 := value
def effect (value : Word) : IO Word := pure value
end Shop
`);
	const copy = { ownership: "copy", lifetime: null };
	const contracts = {
		"Shop.keep": { parameters: [copy], result: { ...copy, refinement: "reject" }, effects: [] }
		, "Shop.borrowWord": { parameters: [{ ownership: "borrow", lifetime: { scope: "call", anchor: null } }] }
		, "Shop.wrongArity": { parameters: [] }
		, "Shop.wrongEffects": { effects: ["async"] }
		, "Shop.checkedWord": { result: { ...copy, refinement: { constructor: "Shop.checked" } } }
		, "Shop.bounded": { parameters: [{ ...copy, refinement: "reject" }] }
		, "Shop.effect": { effects: [] }
		, "Shop.missing": { effects: [] }
	};
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"], contracts }));
	const before = await lakeInputState(context.workspace), analysis = await inspect(context);
	await assertJsonSchema("lake-entry-elaboration", analysis.elaboration);
	await assertJsonSchema("elaborated-export-metadata", analysis.elaboration.metadata);
	assert.deepEqual(analysis.proposedExports, ["lean:Shop.keep"]);
	assert.deepEqual(analysis.bindingIr.document.declarations[0].source.extensions["lean-lang.org/export-contract"], contracts["Shop.keep"]);
	assert.deepEqual(analysis.bindingIr.document.declarations[0].assurance, []);
	const declarations = analysis.elaboration.metadata.modules.flatMap(module => module.declarations);
	for(const name of ["borrowWord", "wrongArity", "wrongEffects", "checkedWord"])
		assert.equal(declarations.find(item => item.identity === `Shop.${name}`).projection.reason, "export-contract-mismatch");
	assert.equal(declarations.find(item => item.identity === "Shop.bounded").projection.status, "unsupported");
	assert.equal(declarations.find(item => item.identity === "Shop.effect").projection.reason, "unsupported-effect");
	assert.ok(analysis.diagnostics.some(item => item.code === "unused-export-contract" && item.declaration === "Shop.missing"));
	assert.ok(analysis.diagnostics.some(item => item.code === "export-contract-mismatch" && item.path === "root/Shop.lean"));
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("fresh metadata preserves aliases, documentation, UTF-16 ranges and actual theorem relationships after relocation", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", `import Catalog
namespace Shop
abbrev Word := UInt32
abbrev Unary := Word → Word
/-- Keep a quote, including its compiler-resolved alias. -/
def quote : Unary := fun value => Catalog.quote value + 1
theorem quote_eq (value : Word) : quote value = Catalog.quote value + 1 := rfl
namespace Shadow
def quote (value : Word) : Word := value
theorem quote_eq (value : Word) : quote value = value := rfl
end Shadow
private def secret : Word := 7
protected def hidden : Word := 8
abbrev Effect := IO Word
def effect (value : Word) : Effect := pure value
def acceptsEffect (_action : IO Word) : Word := 0
def returnsActions : Array (IO Word) := #[]
/-- 🙂 -/ def marker (value : Word) : Word := value
end Shop
`);
	await saveLakeFile(context.root, ".lake/build/lib/lean/Shop.ilean", '{"module":"Shop","decls":{"Forged.theorem":[]}}');
	const before = await lakeInputState(context.workspace);
	const first = await inspect(context);
	await assertJsonSchema("elaborated-export-metadata", first.elaboration.metadata);
	await assertJsonSchema("lake-entry-elaboration", first.elaboration);
	assert.equal(first.bindingIr.origin, "lean-elaborated");
	const declarations = first.elaboration.metadata.modules.find(module => module.name === "Shop").declarations;
	const quote = declarations.find(item => item.identity === "Shop.quote");
	assert.deepEqual(quote.theoremReferences, ["Shop.quote_eq"]);
	assert.match(quote.documentation, /compiler-resolved alias/);
	assert.equal(quote.source.startLine, 5);
	assert.equal(quote.source.startColumn, 0);
	assert.equal(declarations.find(item => item.identity === "Shop.marker").source.endColumn, "/-- 🙂 -/ def marker (value : Word) : Word := value".length);
	assert.equal(quote.projection.parameters[0].type.name, "uint32");
	assert.deepEqual(declarations.find(item => item.identity === "Shop.effect").effects, ["IO"]);
	assert.deepEqual(declarations.find(item => item.identity === "Shop.acceptsEffect").effects, []);
	assert.deepEqual(declarations.find(item => item.identity === "Shop.returnsActions").effects, []);
	assert.ok(declarations.some(item => item.visibility === "private"));
	assert.ok(declarations.some(item => item.visibility === "protected"));
	assert.equal(declarations.some(item => item.identity === "Forged.theorem"), false);
	assert.deepEqual(first.bindingIr.document.assurance, []);
	const moved = join(context.directory, "moved");
	await cp(context.workspace, moved, { recursive: true });
	const second = await inspect({ ...context, root: join(moved, "project") });
	assert.deepEqual(first, second);
	assert.deepEqual(await lakeInputState(context.workspace), before);
});

test("compiler diagnostics distinguish implicit, instance, dependent, generic, effectful and proof-only selections", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", `import Catalog
namespace Shop
def implicitValue {value : UInt32} : UInt32 := value
def instanceValue [Inhabited UInt32] : UInt32 := default
def dependentValue (size : Nat) (_value : Fin size) : UInt32 := 0
universe u
def genericValue {α : Type u} (value : α) : α := value
def effectValue (value : UInt32) : IO UInt32 := pure value
theorem proofValue : True := True.intro
end Shop
`);
	const names = ["implicitValue", "instanceValue", "dependentValue", "genericValue", "effectValue", "proofValue"];
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"], exports: names.map(name => `Shop.${name}`) }));
	const report = await inspect(context);
	assert.equal(report.bindingIr, null);
	assert.deepEqual(report.elaboration.metadata.diagnostics.map(item => item.code).sort(), ["dependent-type", "implicit-parameter", "instance-parameter", "proof-only", "specialization-required", "unsupported-effect"]);
	assert.ok(report.adapterHints.every(item => item.required));
	await assertJsonSchema("elaborated-export-metadata", report.elaboration.metadata);
});

test("namespace collisions remain explicit adapter decisions instead of merged host exports", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", "def First.quote (value : UInt32) := value\ndef Second.quote (value : UInt32) := value\n");
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"] }));
	const report = await inspect(context);
	assert.equal(report.bindingIr, null);
	assert.equal(report.adapterHints.length, 2);
	assert.ok(report.adapterHints.every(item => item.reason === "public-name-collision"));
});

test("finite specializations resolve aliases, universes and instance dictionaries in Lean", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", `import Catalog
initialize IO.FS.writeFile ${JSON.stringify(join(context.directory, "initializer-ran"))} "unexpected"
namespace Shop
universe u v
abbrev Word := UInt32
/-- Keep the chosen concrete value. -/
def keep {α : Type u} (value : α) : α := value
theorem keep_eq {α : Type u} (value : α) : keep value = value := rfl
instance (priority := high) : Inhabited UInt32 := ⟨37⟩
def pick {α : Type u} [Inhabited α] (useValue : Bool) (value : α) : α :=
  if useValue then value else default
def first (α : Type u) (β : Type v) (a : α) (_b : β) : α := a
end Shop
`);
	const specializations = [
		{ name: "Shop.keepWord", declaration: "Shop.keep", types: ["Shop.Word"] }
		, { name: "Shop.keepText", declaration: "Shop.keep", types: ["String"] }
		, { name: "Shop.pickWord", declaration: "Shop.pick", types: ["UInt32"] }
		, { name: "Shop.firstWord", declaration: "Shop.first", types: ["UInt32", "String"] }
	];
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"], exports: specializations.map(item => item.name), specializations }));
	const before = await lakeInputState(context.workspace), first = await inspect(context);
	assert.deepEqual(first.adapterHints, [], JSON.stringify(first.diagnostics));
	await assertJsonSchema("elaborated-export-metadata", first.elaboration.metadata);
	await assertJsonSchema("lake-entry-elaboration", first.elaboration);
	const definitions = first.bindingIr.document.declarations;
	assert.deepEqual(definitions.map(item => item.name), ["firstWord", "keepText", "keepWord", "pickWord"]);
	assert.deepEqual(definitions.find(item => item.name === "firstWord").parameters.map(item => item.type.name), ["uint32", "string"]);
	const keep = definitions.find(item => item.name === "keepWord");
	assert.equal(keep.source.declaration, "Shop.keep");
	assert.deepEqual(keep.source.extensions["lean-lang.org/theorem-references"], ["Shop.keep_eq"]);
	assert.deepEqual(keep.assurance, []);
	assert.equal(keep.parameters[0].type.name, "uint32");
	assert.match(definitions.find(item => item.name === "pickWord").source.extensions["lean-lang.org/specialization"].application, /Shop\.instInhabitedUInt32/);
	const moved = join(context.directory, "moved");
	await cp(context.workspace, moved, { recursive: true });
	assert.deepEqual(await inspect({ ...context, root: join(moved, "project") }), first);
	assert.deepEqual(await lakeInputState(context.workspace), before);
	await assert.rejects(() => access(join(context.directory, "initializer-ran")), { code: "ENOENT" });
	for(const change of [
		item => { item.specialization.types = ["Nat"]; }
		, item => { item.specialization.declaration = "Shop.first"; }
		, item => { item.specialization.application = null; }
		, item => { delete item.specialization; }
		, item => { item.theoremReferences = []; }
	]) {
		const forged = structuredClone(first.elaboration.metadata);
		change(forged.modules.find(module => module.name === "Shop").declarations.find(item => item.identity === "Shop.keepWord"));
		assert.throws(() => validateElaboratedMetadata(forged, first.elaboration.request), { code: "invalid-elaborated-metadata" });
	}
});

test("finite specializations reject unresolved, dependent, effectful and admitted applications", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", `import Catalog
namespace Shop
universe u v
def keep {α : Type u} (value : α) : α := value
def two {α : Type u} {β : Type v} (a : α) (_b : β) : α := a
def dependent {α : Type} (size : Nat) (_value : Fin size) (_a : α) : Nat := size
def effect {α : Type} (a : α) : IO α := pure a
def admitted {α : Type} (a : α) : α := by sorry
class Missing (α : Type) where value : α
def needsMissing {α : Type} [Missing α] : α := Missing.value
class UnsafeDefault (α : Type) where value : α
instance : UnsafeDefault UInt32 := ⟨by sorry⟩
def needsUnsafe {α : Type} [UnsafeDefault α] : α := UnsafeDefault.value
abbrev Words := Array UInt32
end Shop
`);
	const cases = [
		["unknownType", "keep", ["UnknownType"], "invalid-specialization"]
		, ["extraType", "keep", ["UInt32", "String"], "invalid-specialization"]
		, ["remainingType", "two", ["UInt32"], "invalid-specialization"]
		, ["dependentArg", "dependent", ["UInt32"], "dependent-type"]
		, ["effectful", "effect", ["UInt32"], "unsupported-effect"]
		, ["unproven", "admitted", ["UInt32"], "invalid-specialization"]
		, ["missingInstance", "needsMissing", ["UInt32"], "invalid-specialization"]
		, ["admittedInstance", "needsUnsafe", ["UInt32"], "invalid-specialization"]
		, ["container", "keep", ["Shop.Words"], "unsupported-parameter-type"]
	];
	const specializations = cases.map(([name, declaration, types]) => ({ name: `Shop.${name}`, declaration: `Shop.${declaration}`, types }));
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"], exports: specializations.map(item => item.name), specializations }));
	const before = await lakeInputState(context.workspace), result = await inspect(context);
	assert.equal(result.bindingIr, null);
	for(const [name, , , reason] of cases)
		assert.ok(result.adapterHints.some(item => item.declaration === `Shop.${name}` && item.reason === reason), JSON.stringify(result.diagnostics));
	assert.match(result.diagnostics.find(item => item.declaration === "Shop.admittedInstance").message, /sorry/);
	assert.deepEqual(await lakeInputState(context.workspace), before);
	await assertJsonSchema("elaborated-export-metadata", result.elaboration.metadata);
});

test("specialization names cannot shadow declarations or expose a dependency as a public root", { skip: !enabled }, async t => {
	const context = await lakeWorkspaceFixture(t);
	await saveLakeFile(context.root, "Shop.lean", "import Catalog\ndef Shop.keep {α : Type} (value : α) := value\ndef Shop.exists : UInt32 := 2\n");
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"], specializations: [{ name: "Shop.keepWord", declaration: "Shop.keep", types: ["UInt32"] }] }));
	assert.deepEqual((await inspect(context)).bindingIr.document.declarations.map(item => item.name), ["exists", "keepWord"]);
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"], specializations: [{ name: "Shop.exists", declaration: "Shop.keep", types: ["UInt32"] }] }));
	await assert.rejects(() => inspect(context), error => error.code === "lean-metadata-extractor-failed" && /specialization name already exists/.test(JSON.stringify(error.details)));
	await saveLakeFile(context.root, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Shop"], exports: ["Shop.fromDependency"], specializations: [{ name: "Shop.fromDependency", declaration: "Catalog.quote", types: ["UInt32"] }] }));
	const result = await inspect(context);
	assert.equal(result.bindingIr, null);
	assert.equal(result.adapterHints[0].reason, "missing-declaration");
});

test("interface identity includes server/private sidecars and detects changed bytes", async t => {
	const context = await lakeWorkspaceFixture(t), path = join(context.directory, "Sample.olean");
	await writeFile(path, "interface");
	const first = await identifyLeanInterface(path);
	await writeFile(`${path}.server`, "documentation");
	const second = await identifyLeanInterface(path);
	assert.equal(first.oleanSha256, second.oleanSha256);
	assert.notEqual(first.interfaceSha256, second.interfaceSha256);
	await writeFile(`${path}.private`, "private declarations");
	assert.notEqual(second.interfaceSha256, (await identifyLeanInterface(path)).interfaceSha256);
});

test("extractor failures and in-flight interface drift clean owned staging and never edit the project", { skip: !enabled }, async t => {
	for(const mode of ["failure", "json", "sidecar", "cancel"])
	{
		await t.test(mode, async t => {
			const context = await lakeWorkspaceFixture(t);
			if(mode === "sidecar") await saveLakeFile(context.root, "Shop.lean", "module\n/-- Checked module-system export. -/\npublic def Shop.quote (value : UInt32) : UInt32 := value + 1\n");
			const before = await lakeInputState(context.workspace);
			const cancellation = new AbortController();
			let staging;
			const runner = { capture: async request => {
				if(request.args.includes("--metadata"))
				{
					staging = request.cwd;
					if(mode === "cancel")
					{
						cancellation.abort(new Error("Cancelled extraction"));
						throw cancellation.signal.reason;
					}
					if(mode === "failure") throw new Error("Extractor execution failed");
					if(mode === "json") return { stdout: "{incomplete", stderr: "", code: 0 };
					const result = await processBuildRunner.capture(request);
					const report = JSON.parse(result.stdout);
					const declaration = report.modules.find(module => module.name === "Shop").declarations.find(item => item.identity === "Shop.quote");
					assert.match(declaration.documentation, /Checked module-system export/);
					assert.equal(declaration.source.startLine, 2);
					assert.equal(declaration.projection.status, "supported");
					assert.deepEqual(report.diagnostics, []);
					const path = join(request.env.LEAN_PATH, "Shop.olean.server");
					await chmod(path, 0o644);
					await writeFile(path, "changed");
					return result;
				}
				return processBuildRunner.capture(request);
			} };
			await assert.rejects(() => inspect(context, runner, cancellation.signal), error => {
				const expected = mode === "cancel" ? error === cancellation.signal.reason : mode === "sidecar" ? /Interface changed/.test(error.message)
					: error.code === "lean-metadata-extractor-failed" && error.details.category === "extractor-failure";
				assert.equal(expected, true, JSON.stringify(error.details ?? error.message));
				return true;
			});
			assert.ok(staging);
			await assert.rejects(() => readdir(staging), { code: "ENOENT" });
			assert.deepEqual(await lakeInputState(context.workspace), before);
		});
	}
});
