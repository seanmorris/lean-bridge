/**
 * Check generator recipes and output names without executing a Lean toolchain.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { prepareLakeDependencySnapshot } from "../src/build/lake-dependency-snapshot.mjs";
import { runLakeGenerator, validateLakeGeneratorDefinition, validateLakeGeneratorResult } from "../src/build/lake-generators.mjs";
import { lakeGeneratorFixture as fixture } from "./helpers/lake-generator.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";
import { assertJsonSchema } from "./helpers/json-schema.mjs";

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
