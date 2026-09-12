/**
 * Check generator recipes and output names without executing a Lean toolchain.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateGeneratorConfiguration } from "../src/analyze/generator-configuration.mjs";
import { assertExportConfigurationCapabilities, validateExportConfiguration } from "../src/analyze/export-configuration.mjs";
import { join } from "node:path";
import { prepareLakeDependencySnapshot, writeLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { prepareLakeGeneratorPrerequisites, readLakeGeneratorRecipes, validateLakeGeneratorSelection } from "../src/build/lake-generator-prerequisites.mjs";
import { runLakeGenerator, validateLakeGeneratorDefinition, validateLakeGeneratorResult } from "../src/build/lake-generators.mjs";
import { lakeGeneratorFixture as fixture, lakeGeneratorPrerequisiteFixture } from "./helpers/lake-generator.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

test("package-relative generator recipes are closed and normal package builds remain gated", async t => {
	const { configuration, recipe } = await lakeGeneratorPrerequisiteFixture(t);
	assert.equal(validateGeneratorConfiguration(configuration.generators), true);
	assert.equal(validateExportConfiguration(configuration), configuration);
	await assertJsonSchema("lean-export-configuration", configuration);
	for(const target of ["npm", "cpan"])
		assert.throws(() => assertExportConfigurationCapabilities(configuration, { target }), { code: "unsupported-export-configuration" });
	for(const change of [
		recipe => { recipe.profile = "shell"; }
		, recipe => { recipe.command = "sh"; }
		, recipe => { recipe.name = "not-a-lean-name"; }
		, recipe => { recipe.module = "../outside"; }
		, recipe => { recipe.declaration = "Bad\n"; }
		, recipe => { recipe.inputs[0].path = "../outside.txt"; }
		, recipe => { recipe.inputs[0].path = "/outside.txt"; }
		, recipe => { recipe.inputs[0].path = "source//data.txt"; }
		, recipe => { recipe.inputs[0].path = "source/./data.txt"; }
		, recipe => { recipe.inputs[0].path = "source\\data.txt"; }
		, recipe => { recipe.inputs[0].path = "source/\ud800.txt"; }
		, recipe => { recipe.inputs[0].path = "source/.env.local"; }
		, recipe => { recipe.inputs[0].path = "source/.git/config"; }
		, recipe => { recipe.inputs[0].path = "source/.lean-bridge-key/config"; }
		, recipe => { recipe.inputs[0].mode = "binary"; }
		, recipe => { recipe.inputs.push(recipe.inputs[0]); }
		, recipe => { recipe.outputs = []; }
		, recipe => { recipe.outputs[0].path = "build/Generated.lean"; }
		, recipe => { recipe.outputs[0].path = "generated/Table.olean"; }
		, recipe => { recipe.outputs[0].path = "generated/Table.lean/"; }
		, recipe => { recipe.outputs[0].path = "generated/Table.lean"; recipe.outputs[1].path = "generated/Table.lean/extra.h"; }
		, recipe => { recipe.arguments = ["\0"]; }
		, recipe => { recipe.arguments = ["\ud800"]; }
		, recipe => { recipe.arguments = ["é".repeat(8193)]; }
		, recipe => { recipe.arguments = Array(129).fill("a"); }
	]) {
		const invalid = structuredClone(recipe);
		change(invalid);
		assert.throws(() => validateGeneratorConfiguration([invalid]), { code: "invalid-export-configuration" });
	}
	assert.throws(() => validateGeneratorConfiguration([recipe, recipe]), { code: "invalid-export-configuration" });
	assert.throws(() => validateGeneratorConfiguration([recipe, { ...recipe, name: "another" }]), { code: "invalid-export-configuration" });
	const unicode = { ...recipe, arguments: ["😀"], inputs: [{ name: "data", path: "space dir/😀.txt" }] };
	assert.equal(validateGeneratorConfiguration([unicode]), true);
	await assertJsonSchema("lake-generator-configuration", [unicode]);
});

test("generator definitions close profiles, inputs, names and output paths", async t => {
	const context = await fixture(t);
	assert.equal(validateLakeGeneratorDefinition(context.definition, context.snapshot), true);
	await assertJsonSchema("lake-generator-definition", context.definition);
	assert.throws(() => validateLakeGeneratorDefinition(context.definition, { ...context.snapshot, sha256: "0".repeat(64) }), { code: "invalid-lake-generator" });
	for(const change of [
		definition => { definition.profile = "shell"; }
		, definition => { definition.command = "sh"; }
		, definition => { definition.declaration = "Bad; name"; }
		, definition => { definition.modules[0].module = "../Escape"; }
		, definition => { definition.modules[0].path = "root/Absent.lean"; }
		, definition => { definition.modules.push(definition.modules[0]); }
		, definition => { definition.inputs[0].path = "../outside.txt"; }
		, definition => { definition.inputs[0].path = "root/absent.txt"; }
		, definition => { definition.outputs[0].path = "root/data/value.txt"; }
		, definition => { definition.outputs[0].path = "root/tools/TableGenerator.lean"; }
		, definition => { definition.outputs[0].path = "root/data/value.txt/Generated.lean"; }
		, definition => { definition.outputs[0].path = "packages/Absent/Generated.lean"; }
		, definition => { definition.outputs[0].path = "root/.lake/Generated.lean"; }
		, definition => { definition.outputs[0].path = "root/prebuilt.olean"; }
		, definition => { definition.outputs[0].path = "root/escape\\Generated.lean"; }
		, definition => { definition.outputs.push(definition.outputs[0]); }
		, definition => { definition.arguments = ["\0"]; }
		, definition => { definition.arguments = ["\ud800"]; }
		, definition => { definition.arguments = ["é".repeat(8193)]; }
		, definition => { definition.modules[0].module = "LeanBridgeGeneratorMain"; }
		, definition => { definition.outputs[0].path = "root/generated/A.lean"; definition.outputs[1].path = "root/generated/A.lean/B.h"; }
		, definition => { definition.outputs[0].path = "root/generated/../escape.lean"; }
		, definition => { definition.inputs[0].name = "value\n"; }
		, definition => { definition.environment = { FLAG: "1" }; }
	]) {
		const definition = structuredClone(context.definition);
		change(definition);
		assert.throws(() => validateLakeGeneratorDefinition(definition, context.snapshot), { code: "invalid-lake-generator" });
	}
});

test("generator catalogs bind captured recipes and reject malformed selections before execution", async t => {
	const context = await lakeGeneratorPrerequisiteFixture(t), { snapshot } = context;
	const snapshotRoot = join(context.directory, "catalog");
	await writeLakeDependencySnapshot({ snapshot, outputRoot: snapshotRoot });
	const { recipes } = await readLakeGeneratorRecipes({ snapshot, snapshotRoot });
	assert.deepEqual(recipes.map(recipe => recipe.key), ["root/table", "root/unused"]);
	const selection = { schemaVersion: 1, resolver: "lean-lake-generator-selection"
		, leanVersion: "4.32.2", leanCommit: "a".repeat(40)
		, packages: [{ name: "shop", configFile: "root/lakefile.lean", dependencies: ["Catalog"] }, ...snapshot.document.packages.map(pkg => ({ name: pkg.name, configFile: `${pkg.directory}/${pkg.configFile}`, dependencies: [] }))]
		, generators: [{ key: "root/table", package: "shop"
			, module: "TableGenerator", externalImports: ["Init"]
			, modules: [{ module: "GeneratorSupport", path: "root/tools/GeneratorSupport.lean", package: "shop", imports: ["Init"] }, { module: "TableGenerator", path: "root/tools/TableGenerator.lean", package: "shop", imports: ["Init", "GeneratorSupport"] }] }] };
	assert.equal(validateLakeGeneratorSelection({ snapshot, recipes, selection }).length, 1);
	await assertJsonSchema("lake-generator-selection", selection);
	for(const change of [
		selection => { selection.leanCommit += "\n"; }
		, selection => { selection.leanVersion = "0.0.0"; }
		, selection => { selection.packages[0].dependencies = ["Absent"]; }
		, selection => { selection.generators[0].modules.reverse(); }
		, selection => { selection.generators[0].externalImports.push("NotImported"); }
		, selection => { selection.generators[0].modules[0].path = "root/absent.lean"; }
		, selection => { selection.generators[0].modules[0].imports = ["Missing"]; }
	]) {
		const invalid = structuredClone(selection);
		change(invalid);
		assert.throws(() => validateLakeGeneratorSelection({ snapshot, recipes, selection: invalid }), { code: "invalid-lake-generator-selection" });
	}
	for(const modules of [[], ["../Escape"], ["Shop", "Shop"], ["A".repeat(257)]])
		await assert.rejects(() => prepareLakeGeneratorPrerequisites({ snapshot, modules, leanPrefix: "/absent" }), { code: "invalid-lake-generator-selection" });
	await saveLakeFile(snapshotRoot, "root/lean-bridge.exports.json", "{}\n");
	await assert.rejects(() => readLakeGeneratorRecipes({ snapshot, snapshotRoot }), /changed|differ/);
});

test("generator results require exact names, valid Unicode and bounded text", async t => {
	const { definition } = await fixture(t);
	assert.equal(validateLakeGeneratorResult(definition, [["header", "😀\n"], ["lean", ""]])[0].content.length, 0);
	for(const entries of [[], [["lean", ""]], [["lean", ""], ["header", ""], ["extra", ""]], [["lean", ""], ["lean", ""]], [["lean", "\ud800"], ["header", ""]], [["lean", 4], ["header", ""]]])
		assert.throws(() => validateLakeGeneratorResult(definition, entries), { code: "invalid-lake-generator" });
	assert.throws(() => validateLakeGeneratorResult(definition, [["lean", "x".repeat(8 * 1024 * 1024 + 1)], ["header", ""]]), { code: "lake-generator-limit" });
});

test("invalid captured text fails before any compiler invocation", async t => {
	for(const path of ["data/value.txt", "tools/TableGenerator.lean"])
	{
		const context = await fixture(t);
		await saveLakeFile(context.root, path, Buffer.from([0xff]));
		const snapshot = await prepareLakeDependencySnapshot({ projectRoot: context.root, includeProject: true });
		const runner = { capture: () => assert.fail("Invalid text must not reach a compiler") };
		await assert.rejects(() => runLakeGenerator({ snapshot, definition: context.definition, leanPrefix: context.directory, runner }), /valid UTF-8 text/);
	}
});
