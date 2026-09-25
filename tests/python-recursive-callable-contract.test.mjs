/**
 * Preserve directional Python types over the shared recursive callable layout.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { compileCallablePythonGraphPackageModel } from "../src/backends/python/callable-graph-model.mjs";
import { generateCallablePythonGraphPackage } from "../src/backends/python/callable-graph-package.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { auditPythonPackage } from "../src/backends/python/package-audit.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";

test("recursive Python callable packages share the C-family layout without requiring a C package", () => {
	const ir = nativeRecursiveCallableReviewedIr(), before = canonicalJson(ir);
	const python = compileCallablePythonGraphPackageModel(ir);
	assert.equal(python.functions.length, 33); assert.equal(python.callbacks.size, 18);
	assert.equal(python.callableGraph, true); assert.equal(python.requiresTypeAliases, true);
	for(const targets of [["pypi"], ["c"], ["cpp"], ["pypi", "c", "cpp"], ["cpp", "pypi"]])
		assert.equal(compileNativeGraphProjection(ir, targets).layoutSha256, python.layoutSha256);
	for(const targets of [undefined, {}, [], ["pypi", "pypi"], ["pypi", "cargo"], ["pypi", "cpan"], ["pypi", "unknown"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
	assert.equal(canonicalJson(ir), before);
});

test("recursive Python public declarations retain callbacks, closure ownership and nominal copied values", () => {
	const ir = nativeRecursiveCallableReviewedIr(), files = generateCallablePythonGraphPackage(ir);
	assert.deepEqual(generateCallablePythonGraphPackage(ir), files);
	const model = compileCallablePythonGraphPackageModel(ir);
	assert.equal(auditPythonPackage(ir, files).exports.length, model.exports.length);
	for(const file of ["lean_structured/__init__.py", "lean_structured/__init__.pyi"])
	{
		const source = files[file];
		assert.match(source, /def call_recursive\([^\n]+\) -> Tree:/u);
		assert.match(source, /def make_recursive\([^\n]+\) -> LeanClosure\[\[bool, Tree\], Tree\]:/u);
		assert.match(source, /def __deepcopy__\(self, memo: dict\[int, object\]\) -> _Never:/u);
		assert.doesNotMatch(source, /\bAny\b|ctypes|c_void_p|c_uint64|dispatch|_GraphLease/u);
	}
	for(const callback of model.callbacks.values())
	{
		assert.ok(callback.callableType.startsWith("_Callable[["));
		assert.ok(callback.closureType.startsWith("LeanClosure[["));
	}
	const source = files["lean_structured/_native.py"];
	assert.match(source, /_threading\.current_thread\(\) is not self\.thread/u);
	assert.match(source, /if frame\.failure is None: frame\.failure = failure/u);
	assert.match(source, /finally:\n\s+frame\.close\(\)/u);
	assert.match(source, /if isinstance\(failure, _GraphInvalidNative\): _graph_retire\(\)/u);
	assert.match(files["lean_structured/_assets.py"], /Build a compiled PyPI release/u);
	assert.match(files["README.md"], /128 levels deep|262,144 nodes|16 MiB/u);
	assert.deepEqual(JSON.parse(files["binding-manifest.json"]).copiedGraph, { schemaVersion: 1, layoutSha256: model.layoutSha256 });
});

test("recursive Python callbacks reject unowned identities, effects and public name collisions", () => {
	for(const mutate of [
		ir => { ir.types.find(type => type.kind === "callback").name = "LeanClosure"; }
		, ir => { ir.declarations[0].name = "class"; }
		, ir => { ir.declarations[0].parameters[0].name = "lambda"; }
		, ir => { ir.types.find(type => type.kind === "callback").callable.resultMode = "promise"; }
		, ir => { ir.types.find(type => type.kind === "callback").callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Payload").fields[0].type = { kind: "named", id: ir.types.find(type => type.kind === "callback").id }; }
	]) {
		const ir = nativeRecursiveCallableReviewedIr(); mutate(ir);
		assert.throws(() => compileCallablePythonGraphPackageModel(ir));
	}
});
