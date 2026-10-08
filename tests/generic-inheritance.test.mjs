/**
 * Inherited generic records: an inherited parent's unnamed type resolves to the one source alias
 * that denotes it; none or several refuse, and explicitly named fields never take this path.
 *
 * @file
 */
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { parentAliasRunner } from "./helpers/parent-alias-entry.mjs";
import "./helpers/inherited-records-source-history-tests.mjs";
import { inspectLeanProject } from "../src/analyze/lean-project.mjs";
import { prepareLakeEntryIntent } from "../src/build/lake-entry-intent.mjs";
import { resolveLakeBuildWorkspace } from "../src/build/lake-build-workspace.mjs";
import { elaborateLakeEntryModules } from "../src/build/lake-entry-elaboration.mjs";
import { processBuildRunner } from "../src/build/process-runner.mjs";
import { buildElaboratedComponent } from "../src/build/elaborated-component.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters } from "../src/build/native-graph-model.mjs";

const lean = process.env.LEAN_BRIDGE_GENERIC_INHERITANCE_LEAN_TEST === "1";
const fixture = "tests/fixtures/onboarding/generic-inheritance";
const leanPrefix = join(process.cwd(), ".toolchains/elan/toolchains/leanprover--lean4---v4.32.2");
const equalAlias = "abbrev NatBaseAgain := Base Nat\n";

/**
 * Build the native model of a fixture variant and compile its Lean adapters, stopping before C.
 *
 * @param t - Test context.
 * @param edit - Source transformation.
 * @param names - Exported short names.
 * @param files - Additional project files by relative path.
 * @param runner - Optional process runner, such as the test-only extractor entry.
 */
const nativeModel = async (t, edit, names, files = {}, runner = undefined) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-inheritance-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const projectRoot = join(directory, "project");
	await cp(fixture, projectRoot, { recursive: true });
	await writeFile(join(projectRoot, "GenericInheritance.lean"), edit(await readFile(join(fixture, "GenericInheritance.lean"), "utf8")));
	for(const [path, contents] of Object.entries(files)) await saveLakeFile(projectRoot, path, contents);
	const exports = names.map(name => `GenericInheritance.${name}`), targets = { c: { name: "genericinheritance", version: "1.0.0" } };
	await writeFile(join(projectRoot, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: ["GenericInheritance"], exports, targets }));
	let captured;
	const options = {
		projectRoot
		, outputRoot: join(directory, "out")
		, leanPrefix
		, targets: ["c"]
		, profile: "native-library-v1"
		, receiptName: "native-component.json"
		, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
		, createAdapters: generateCompiledNativeLeanAdapters
		, compileComponent: async ({ model }) => { captured = model; throw Object.assign(new Error("stop before C"), { code: "stop-before-c" }); }
		, ...(runner ? { runner } : {})
	};
	await assert.rejects(() => buildElaboratedComponent(options), error => {
		if(error.code !== "stop-before-c") throw error;
		return true;
	});
	return captured;
};
const refused = async (t, edit, names, files, runner) => {
	let message;
	await assert.rejects(() => nativeModel(t, edit, names, files, runner), error => {
		message = JSON.stringify(error.details ?? error.message);
		return true;
	});
	return message;
};
const record = (model, name) => model.bindingIr.types.find(type => type.id === `lean:GenericInheritance.${name}`);
const fieldTypes = definition => definition.fields.map(field => [field.name, field.type.id ?? field.type.name]);
const unchanged = source => source;
const replace = (from, to) => source => { assert.ok(source.includes(from), from); return source.replace(from, to); };
const append = text => replace("end GenericInheritance", `${text}\nend GenericInheritance`);

test("an inherited generic parent resolves to its one source alias, with universes and phantom arguments", { skip: !lean, timeout: 900_000 }, async t => {
	const model = await nativeModel(t, unchanged, ["grow", "lift", "relabel"]);
	assert.deepEqual(fieldTypes(record(model, "NatChild")), [["toBase", "lean:GenericInheritance.NatBase"], ["child", "nat"]]);
	assert.deepEqual(fieldTypes(record(model, "UNatChild")), [["toUBase", "lean:GenericInheritance.UNatBase"], ["extra", "nat"]]);
	assert.deepEqual(fieldTypes(record(model, "MarkerTagged")), [["toTag", "lean:GenericInheritance.MarkerTag"], ["count", "nat"]]);
	// The child keeps its own origin; the parent alias keeps its own, and Marker stays provenance only.
	const origin = name => record(model, name).source.extensions["lean-lang.org/instantiation"];
	assert.deepEqual(origin("NatChild"), { structure: "GenericInheritance.Child", arguments: [{ kind: "primitive", name: "nat" }] });
	assert.deepEqual(origin("NatBase"), { structure: "GenericInheritance.Base", arguments: [{ kind: "primitive", name: "nat" }] });
	assert.deepEqual(origin("MarkerTagged").arguments, [{ kind: "named", id: "lean:GenericInheritance.Marker" }]);
	assert.ok(!model.types.some(type => type.name === "GenericInheritance.Marker"));
});

test("no alias, several aliases, a namespace collision and recursion refuse with exact, order-independent diagnostics", { skip: !lean, timeout: 1_800_000 }, async t => {
	assert.match(await refused(t, replace("abbrev NatBase := Base Nat\n", ""), ["grow"]), /name this inherited generic parent with an abbrev in the compiled source/u);
	const ambiguity = /ambiguous inherited generic parent; candidates: GenericInheritance\.NatBase, GenericInheritance\.NatBaseAgain/u;
	const after = await refused(t, replace("abbrev NatChild := Child Nat", `${equalAlias}abbrev NatChild := Child Nat`), ["grow"]);
	const before = await refused(t, replace("abbrev NatBase := Base Nat\n", `${equalAlias}abbrev NatBase := Base Nat\n`), ["grow"]);
	assert.match(after, ambiguity);
	assert.equal(after.match(ambiguity)[0], before.match(ambiguity)[0], "candidates are sorted, never declaration-ordered");
	assert.match(await refused(t, replace("abbrev NatChild := Child Nat", "namespace A\nabbrev NatBase := Base Nat\nend A\nabbrev NatChild := Child Nat"), ["grow"])
		, /ambiguous inherited generic parent; candidates: GenericInheritance\.A\.NatBase, GenericInheritance\.NatBase/u);
	const recursive = "structure Node (α : Type) extends Base (List (Node α)) where\n  label : α\nabbrev NatNode := Node Nat\nabbrev NodeBase := Base (List (Node Nat))\ndef first (value : NatNode) : Nat := value.label";
	assert.match(await refused(t, append(recursive), ["first"]), /recursive generic records are not admitted/u);
});

test("a field that names its alias explicitly is never ambiguous, even beside an equal alias", { skip: !lean, timeout: 900_000 }, async t => {
	const model = await nativeModel(t, source => append("def peek (value : NatBase) : Nat := value.base")(replace("abbrev NatChild := Child Nat", `${equalAlias}abbrev NatChild := Child Nat`)(source)), ["peek"]);
	assert.deepEqual(model.bindingIr.declarations.map(item => item.id), ["lean:GenericInheritance.peek"]);
	assert.ok(record(model, "NatBase") && !record(model, "NatBaseAgain"));
});

test("a source module imported into the compiled closure adds a candidate and makes the parent ambiguous", { skip: !lean, timeout: 900_000 }, async t => {
	// The parent structure moves to its own module so another source module can name it too.
	const base = "namespace GenericInheritance\nstructure Base (α : Type) where\n  base : α\nend GenericInheritance\n";
	const extra = "import GenericInheritance.Core\nnamespace GenericInheritance\nabbrev ExtraBase := Base Nat\nend GenericInheritance\n";
	const split = source => `import GenericInheritance.Core\nimport GenericInheritance.Extra\n${source.replace("structure Base (α : Type) where\n  base : α\n\n", "")}`;
	const files = { "GenericInheritance/Core.lean": base, "GenericInheritance/Extra.lean": extra };
	assert.match(await refused(t, split, ["grow"], files), /ambiguous inherited generic parent; candidates: GenericInheritance\.ExtraBase, GenericInheritance\.NatBase/u);
	// Without the second alias the same split closure resolves to NatBase.
	const model = await nativeModel(t, split, ["grow"], { ...files, "GenericInheritance/Extra.lean": "import GenericInheritance.Core\n" });
	assert.deepEqual(fieldTypes(record(model, "NatChild")), [["toBase", "lean:GenericInheritance.NatBase"], ["child", "nat"]]);
});

/**
 * Elaborate a fixture variant through the test-only extractor entry with a chosen work limit.
 *
 * @param t - Test context.
 * @param edit - Source transformation.
 * @param names - Exported short names.
 * @param limit - Declarations the alias index may scan.
 */
const counted = async (t, edit, names, limit) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-parent-alias-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const root = join(directory, "project");
	await cp(fixture, root, { recursive: true });
	await writeFile(join(root, "GenericInheritance.lean"), edit(await readFile(join(fixture, "GenericInheritance.lean"), "utf8")));
	await writeFile(join(root, "lean-bridge.exports.json"), canonicalJson({ schemaVersion: 1, modules: ["GenericInheritance"], exports: names.map(name => `GenericInheritance.${name}`) }));
	const { runner, counters } = await parentAliasRunner(directory, limit);
	const intent = await prepareLakeEntryIntent({ projectRoot: root });
	const engineRoot = process.cwd();
	const leanPrefix = (await processBuildRunner.capture({ command: join(engineRoot, ".toolchains/elan/bin/lean"), args: ["--print-prefix"], cwd: engineRoot })).stdout.trim();
	const workspace = await resolveLakeBuildWorkspace({ snapshot: intent.lakeSnapshot, modules: intent.document.modules.map(module => module.module), leanPrefix });
	try
	{
		const inventory = await inspectLeanProject(root);
		const result = await elaborateLakeEntryModules({ inventory, entries: intent.document.modules, workspace, leanPrefix, engineRoot, runner });
		return { result, counters: await counters() };
	}
	finally
	{ await workspace.dispose(); }
};

test("inherited-parent discovery builds one index per request, probes each parent once and reuses it", { skip: !lean, timeout: 900_000 }, async t => {
	const { result, counters } = await counted(t, unchanged, ["grow", "lift", "relabel"], 65536);
	assert.ok(result.bindingIr);
	// Three distinct parents, one candidate each; grow and relabel reuse their parent for the result.
	assert.deepEqual({ attempts: counters.attempts, builds: counters.builds, probes: counters.probes, hits: counters.hits, exhausted: counters.exhausted }, { attempts: 1, builds: 1, probes: 3, hits: 2, exhausted: false });
	assert.ok(counters.scanned > 0);
});

test("the work limit applies only when discovery runs, and exhaustion is attempted once and refuses deterministically", { skip: !lean, timeout: 900_000 }, async t => {
	const plain = append("def plain (value : Nat) : Nat := value + 1");
	const exported = result => result.bindingIr?.document.declarations.map(item => item.id) ?? null;
	// One scan past a limit of 1 reads exactly two declarations, and no later site scans again.
	const exhausted = { attempts: 1, builds: 0, scanned: 2, probes: 0, hits: 0, exhausted: true };
	// A module with no inherited generic record never scans, however small the limit.
	const ordinary = await counted(t, () => "namespace GenericInheritance\ndef plain (value : Nat) : Nat := value + 1\nend GenericInheritance\n", ["plain"], 1);
	assert.deepEqual(exported(ordinary.result), ["lean:GenericInheritance.plain"]);
	assert.deepEqual(ordinary.counters, { attempts: 0, builds: 0, scanned: 0, probes: 0, hits: 0, exhausted: false });
	// Beside inherited declarations, which extraction still describes, an exhausted search refuses only the declarations that need it.
	const beside = await counted(t, plain, ["plain"], 1);
	assert.deepEqual(exported(beside.result), ["lean:GenericInheritance.plain"]);
	assert.deepEqual(beside.counters, exhausted);
	// Every exported inherited parent past the limit is refused with the same diagnostic, and the index is never trusted half-built.
	const names = ["grow", "lift", "relabel"];
	const limited = await counted(t, plain, names, 1);
	assert.equal(limited.result.bindingIr, null);
	assert.deepEqual(limited.counters, exhausted);
	// The native model reports why each export is refused: every site carries the one exhaustion diagnostic.
	const scratch = await mkdtemp(join(tmpdir(), "lean-bridge-parent-alias-native-"));
	t.after(() => rm(scratch, { recursive: true, force: true }));
	const native = await parentAliasRunner(scratch, 1);
	const { projections } = JSON.parse(await refused(t, plain, names, {}, native.runner));
	const diagnostic = "inherited parent alias search exceeds its limit of 1 declarations";
	assert.deepEqual(projections.map(item => [item.declaration, item.status, item.expression]), names.map(name => [`GenericInheritance.${name}`, "unsupported", diagnostic]));
	assert.deepEqual(await native.counters(), exhausted);
});

/**
 * A project whose generic parent comes from a captured path dependency. The dependency's root
 * module is imported; its Unused module, which repeats the alias, is not.
 *
 * @param t - Test context.
 * @param projectAlias - Also declare an equal alias in the project.
 */
const dependencyModel = async (t, projectAlias) => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-generic-inheritance-dependency-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const toolchain = await readFile(join(fixture, "lean-toolchain"), "utf8");
	const dependency = join(directory, "baselib"), projectRoot = join(directory, "project");
	await saveLakeFile(dependency, "lean-toolchain", toolchain);
	await saveLakeFile(dependency, "lakefile.toml", "name = \"baselib\"\nversion = \"1.0.0\"\n[[lean_lib]]\nname = \"BaseLib\"\n");
	await saveLakeFile(dependency, "lake-manifest.json", JSON.stringify({ version: "1.2.0", packages: [] }));
	await saveLakeFile(dependency, "BaseLib.lean", "namespace BaseLib\nstructure Base (α : Type) where\n  base : α\nabbrev DepBase := Base Nat\nend BaseLib\n");
	await saveLakeFile(dependency, "BaseLib/Unused.lean", "import BaseLib\nnamespace BaseLib\nabbrev UnusedBase := Base Nat\nend BaseLib\n");
	await saveLakeFile(projectRoot, "lean-toolchain", toolchain);
	await saveLakeFile(projectRoot, "lakefile.toml", "name = \"inherit\"\nversion = \"1.0.0\"\n[[require]]\nname = \"baselib\"\npath = \"../baselib\"\n[[lean_lib]]\nname = \"Inherit\"\n");
	const packages = [{ type: "path", name: "baselib", inherited: false, dir: "../baselib", configFile: "lakefile.toml", manifestFile: "lake-manifest.json" }];
	await saveLakeFile(projectRoot, "lake-manifest.json", JSON.stringify({ version: "1.2.0", name: "inherit", lakeDir: ".lake", packagesDir: ".lake/packages", fixedToolchain: false, packages }));
	await saveLakeFile(projectRoot, "Inherit.lean", `import BaseLib\nnamespace Inherit\nstructure Child (α : Type) extends BaseLib.Base α where\n  child : Nat\n${projectAlias ? "abbrev NatBase := BaseLib.Base Nat\n" : ""}abbrev NatChild := Child Nat\ndef grow (value : NatChild) : Nat := value.child\nend Inherit\n`);
	await saveLakeFile(projectRoot, "lean-bridge.exports.json", canonicalJson({ schemaVersion: 1, modules: ["Inherit"], exports: ["Inherit.grow"], targets: { c: { name: "inherit", version: "1.0.0" } } }));
	let captured;
	const options = {
		projectRoot
		, outputRoot: join(directory, "out")
		, leanPrefix
		, targets: ["c"]
		, profile: "native-library-v1"
		, receiptName: "native-component.json"
		, createModel: input => createCompiledNativeModel(input, { nativeRefinements: true })
		, createAdapters: generateCompiledNativeLeanAdapters
		, compileComponent: async ({ model }) => { captured = model; throw Object.assign(new Error("stop before C"), { code: "stop-before-c" }); }
	};
	let failure;
	await assert.rejects(() => buildElaboratedComponent(options), error => {
		if(error.code !== "stop-before-c") failure = JSON.stringify(error.details ?? error.message);
		return true;
	});
	return { model: captured, failure };
};

test("an imported captured dependency's alias can name the parent; an unimported module of it cannot", { skip: !lean, timeout: 1_800_000 }, async t => {
	const { model, failure } = await dependencyModel(t, false);
	assert.equal(failure, undefined);
	const child = model.bindingIr.types.find(type => type.id === "lean:Inherit.NatChild");
	assert.deepEqual(fieldTypes(child), [["toBase", "lean:BaseLib.DepBase"], ["child", "nat"]]);
	assert.ok(!model.bindingIr.types.some(type => type.id === "lean:BaseLib.UnusedBase"));
	// The imported dependency and the project are one compiled closure, so an equal project alias makes it ambiguous.
	assert.match((await dependencyModel(t, true)).failure, /ambiguous inherited generic parent; candidates: BaseLib\.DepBase, Inherit\.NatBase/u);
});
