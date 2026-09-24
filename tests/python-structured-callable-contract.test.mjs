/**
 * Structured Python admission, directional annotations and complete fault receipts.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { compileCopiedPythonModel } from "../src/backends/python/copied-model.mjs";
import { generateCopiedPythonPackage } from "../src/backends/python/copied-values.mjs";
import { structuredCallableReviewedIr } from "./helpers/structured-callable-fixture.mjs";
import { assertPythonStructuredCodegenRegression } from "./helpers/python-structured-callable-regression.mjs";
import { assertPythonStructuredFaults } from "./helpers/python-structured-callable-install.mjs";

test("Python structured callbacks preserve all earlier generated packages byte for byte", async () => {
	const record = JSON.parse(await readFile("docs/evidence/python-structured-codegen-regression-20260924.json"));
	for(const [path, hash] of Object.entries(record.sourceHashes)) assert.equal(sha256(await readFile(path)), hash, path);
	assertPythonStructuredCodegenRegression(record);
	const altered = structuredClone(record);
	Object.values(altered.fixtures[0].files)[0].sha256 = "0".repeat(64);
	assert.throws(() => assertPythonStructuredCodegenRegression(altered));
});

test("Python callback annotations follow value direction while retaining ownership restrictions", () => {
	const { surface } = compileCopiedPythonModel(structuredCallableReviewedIr());
	assert.equal(surface.functions.length, 26); assert.equal(surface.callbacks.size, 14);
	for(const value of surface.callbacks.values())
	{
		const { parameters, result } = value.type.callable;
		assert.equal(value.inputType, `_Callable[[${parameters.map(site => surface.copy(site.type).publicType).join(", ")}], ${surface.copy(result.type).inputType}]`);
		assert.equal(value.publicType, `LeanClosure[[${parameters.map(site => surface.copy(site.type).inputType).join(", ")}], ${surface.copy(result.type).publicType}]`);
	}
	for(const mutate of [
		ir => { ir.types.find(type => type.callable).callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.callable).callable.result.lifetime = { scope: "explicit", anchor: null }; }
		, ir => { ir.types.find(type => type.callable).callable.resultMode = "promise"; }
		, ir => { const callback = ir.types.find(type => type.callable); callback.callable.result.type = { kind: "named", id: callback.id }; }
	]) {
		const ir = structuredCallableReviewedIr(); mutate(ir);
		assert.throws(() => compileCopiedPythonModel(ir), { code: "unsupported-native-c-signature" });
	}
	assert.throws(() => compileCopiedPythonModel(structuredCallableReviewedIr({ recursive: true })), { code: "unsupported-native-c-signature" });
	const files = generateCopiedPythonPackage(structuredCallableReviewedIr());
	assert.doesNotMatch(files["lean_structured/__init__.pyi"], /Any|ctypes|c_void_p|dispatch/);
	assert.match(files["README.md"], /acyclic copied structured callbacks/);
	assert.doesNotMatch(files["README.md"], /List callback payloads remain unsupported|compound callable payloads remain unsupported/);
	assert.match(files["binding-manifest.json"], /acyclic structured callables/);
});

test("Python fault records require every shape, both exception kinds and every execution path", () => {
	const shapes = ["array", "list", "option", "result", "tuple", "record", "variant", "alias"];
	const valid = { checks: 3000, faults: 1600, clears: 2000, closes: 2000
		, malformed: 12
		, shapes: shapes.map(shape => ({ shape, paths: { callback: 20, create: 20, "create-call": 20, "held-call": 20, repeated: 20 }, faults: 200 })) };
	assertPythonStructuredFaults(valid);
	for(const change of [
		value => { value.shapes.pop(); }
		, value => { value.shapes[7].shape = "array"; }
		, value => { value.shapes[0].paths.callback = 0; }
		, value => { delete value.shapes[0].paths.create; }
		, value => { value.shapes[0].faults /= 2; }
		, value => { value.faults -= 1; }
		, value => { value.malformed = 0; }
	]) {
		const altered = structuredClone(valid); change(altered);
		assert.throws(() => assertPythonStructuredFaults(altered));
	}
});
