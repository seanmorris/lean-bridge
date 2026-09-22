/**
 * Native recursive components preserve compiler facts and total carrier ABIs.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson } from "../src/capsule/node.mjs";
import { validateBindingIr } from "../src/binding-ir/contract.mjs";
import { createNativeModel, generateNativeLeanAdapters } from "../src/build/native-model.mjs";
import { createCompiledNativeModel, generateCompiledNativeLeanAdapters, nativeGraphCarrierAbi } from "../src/build/native-graph-model.mjs";
import { nativeMetadataFixture } from "./helpers/native-metadata.mjs";
import { checkNativeRecursiveTransport } from "./helpers/native-recursive-transport.mjs";
import { nativeRecursiveReviewedIr } from "./helpers/native-recursive-reviewed.mjs";

const fixture = () => {
	const input = nativeMetadataFixture(), projection = input.metadata.modules[0].declarations[0].projection;
	const abi = { cType: "lean_object*", box: "lean_box", unbox: "lean_unbox", heap: true };
	const reference = { kind: "reference", name: "Sample.Tree", lean: "Sample.Tree", abi };
	const tree = { kind: "variant", name: "Sample.Tree", lean: "Sample.Tree", abi
		, cases: [{ name: "leaf", constructor: "Sample.Tree.leaf", fields: [{ name: "value", type: projection.result }] }
			, { name: "next", constructor: "Sample.Tree.next", fields: [{ name: "child", type: reference }] }] };
	const graph = { kind: "graph", root: reference, types: [tree], abi };
	projection.parameters[0].type = graph; projection.result = graph;
	return { ...input, component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
};

test("the independent native graph review selects eighteen distinct exports", () => {
	const ir = nativeRecursiveReviewedIr(); validateBindingIr(ir);
	assert.equal(ir.declarations.length, 18);
	assert.equal(new Set(ir.declarations.map(item => item.overloadKey)).size, 18);
	assert.equal(ir.types.find(type => type.name === "Wide").cases[0].fields.length, 256);
});

test("compiled native graph models preserve finite metadata and authenticate carrier identities", () => {
	const input = fixture(), before = canonicalJson(input);
	assert.throws(() => createNativeModel(input), /bounded graph transport/u);
	const model = createCompiledNativeModel(input), abi = nativeGraphCarrierAbi(model);
	assert.equal(model.schemaVersion, 4); assert.equal(model.pointerBits, 64);
	assert.equal(model.copiedGraph.types.length, 1); assert.equal(model.copiedGraph.types[0].cases.length, 2);
	assert.deepEqual(abi.exports[0].parameters, [{ kind: "named", id: "lean:Sample.Tree" }]);
	assert.equal(model.exports[0].symbol, `${abi.exports[0].symbol}_lean`);
	assert.equal(canonicalJson(input), before);
	assert.doesNotMatch(canonicalJson(model), /copied-graph-frame-v1/u);
	for(const mutate of [
		value => { value.pointerBits = 32; }
		, value => { value.copiedGraph.exports[0].symbol = `lean_bridge_${"f".repeat(24)}`; }
		, value => { value.copiedGraph.types[0].cases.reverse(); }
		, value => { value.copiedGraph.schemaVersion = 2; }
	]) {
		const changed = structuredClone(model); mutate(changed);
		assert.throws(() => nativeGraphCarrierAbi(changed), /differ/u);
	}
	assert.throws(() => createCompiledNativeModel({ ...input, moduleName: "LeanBridge::Sample" }), error => error.code === "native-graph-projection-unavailable");
});

test("native graph helpers use total typed arrays and explicit prototype checks", () => {
	const output = generateCompiledNativeLeanAdapters(createCompiledNativeModel(fixture()));
	assert.match(output.leanSource, /import Sample/u);
	assert.match(output.leanSource, /carrierValue/u); assert.match(output.leanSource, /_root_\.Sample\.increment/u);
	assert.doesNotMatch(output.leanSource, /\b(?:unsafe|unsafeCast|partial|sorry|axiom|defaultValue)\b/u);
	assert.match(output.header, /uint32_t lean_bridge_[a-f0-9]+_recursive_[a-f0-9]+_branch\(lean_object \*\);/u);
	assert.match(output.header, /lean_object \* lean_bridge_[a-f0-9]+_lean\(lean_object \*\);/u);
});

test("non-graph native models and emitted adapters are unchanged", () => {
	const input = { ...nativeMetadataFixture(), component: { id: "sample@1.0.0", name: "sample", version: "1.0.0" } };
	const legacy = createNativeModel(input), compiled = createCompiledNativeModel(input);
	assert.deepEqual(compiled, legacy);
	assert.deepEqual(generateCompiledNativeLeanAdapters(compiled), generateNativeLeanAdapters(legacy));
});

test("ordinary and reviewed native graph components execute independent C and C++ callers", {
	skip: process.env.LEAN_BRIDGE_NATIVE_RECURSIVE_TEST !== "1", timeout: 900000
}, async t => {
	const results = [];
	for(const reviewed of [false, true])
	{
		const directory = await mkdtemp(join(tmpdir(), "lean-native-graph-component-"));
		try
		{
			const result = await checkNativeRecursiveTransport(directory, { component: true, reviewed, cpp: true });
			assert.equal(result.checks, 169840); assert.equal(result.exports, 18);
			assert.ok(result.cppChecks >= 250, `C++ assertions executed: ${result.cppChecks}`);
			assert.equal(result.reviewed, reviewed); results.push(result);
			t.diagnostic(`${reviewed ? "reviewed" : "ordinary"} component: ${result.checks} C checks, ${result.cppChecks} C++ checks, binary ${result.binarySha256}`);
		}
		finally
		{ await rm(directory, { recursive: true, force: true }); }
	}
	assert.equal(results[0].binarySha256, results[1].binarySha256);
	assert.equal(results[0].cppChecks, results[1].cppChecks);
});
