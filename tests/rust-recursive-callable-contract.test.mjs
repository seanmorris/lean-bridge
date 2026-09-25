/**
 * Typed recursive Rust callbacks, shared native layouts and safe public names.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCallableRustGraphPackageModel } from "../src/backends/rust/callable-graph-model.mjs";
import { generateCallableRustGraphPackage } from "../src/backends/rust/callable-graph-package.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { compileCallableGraphPackageModel } from "../src/backends/c/callable-graph-model.mjs";
import { auditRustPackage } from "../src/backends/rust/package-audit.mjs";

test("Rust recursive callbacks use authenticated payloads and expose safe typed APIs", () => {
	const ir = nativeRecursiveCallableReviewedIr(), before = structuredClone(ir);
	const model = compileCallableRustGraphPackageModel(ir), files = generateCallableRustGraphPackage(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCallableRustGraphPackage(ir), files);
	assert.equal(model.layoutSha256, compileCallableGraphPackageModel(ir, ["c", "cpp"]).layoutSha256);
	assert.equal(model.functions.length, 33); assert.equal(model.callbacks.size, 18); assert.equal(model.closureSignatures.length, 17);
	assert.deepEqual(auditRustPackage(ir, files).exports, model.exports);
	const source = files["src/lib.rs"];
	assert.match(source, /pub fn call_recursive\(arg0: &Tree, arg1: impl FnMut\(Tree\) -> Result<Tree, Error>\) -> Result<Tree, Error>/);
	assert.match(source, /pub fn call_alias\(arg0: &Alias, arg1: impl FnMut\(Payload\) -> Result<Payload, Error>\) -> Result<Alias, Error>/);
	assert.match(source, /pub fn make_recursive\(arg0: &Tree\) -> Result<LeanClosure<fn\(bool, &Tree\) -> Tree>, Error>/);
	assert.doesNotMatch(source, /unsafe|extern|c_void|GraphRaw|graph_call|lease_call|lease_dispose/);
	assert.match(files["src/__runtime.rs"], /PhantomData<std::rc::Rc<\(\)>>/);
	assert.match(files["src/__runtime.rs"], /scope.one\(value\)/);
	assert.match(files["src/__runtime.rs"], /let result = copied/);
	assert.match(files["README.md"], /4,096-identity/);
});

test("Cargo-only recursive callables agree with every selected supported native target", () => {
	const ir = nativeRecursiveCallableReviewedIr(), expected = compileCallableRustGraphPackageModel(ir).layoutSha256;
	for(const targets of [["cargo"], ["cargo", "c"], ["cpp", "cargo"], ["pypi", "cargo"], ["cargo", "rubygems"], ["cargo", "c", "cpp", "pypi", "rubygems"]])
		assert.equal(compileNativeGraphProjection(ir, targets).layoutSha256, expected);
	for(const targets of [[], ["cargo", "cargo"], ["cargo", "cpan"], ["cargo", "nuget"], ["unknown"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
	for(const mutate of [
		ir => { ir.types.find(type => type.kind === "callback").callable.resultMode = "promise"; }
		, ir => { ir.types.find(type => type.kind === "callback").callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Payload").fields[0].type = { kind: "named", id: ir.types.find(type => type.kind === "callback").id }; }
	]) {
		const invalid = nativeRecursiveCallableReviewedIr(); mutate(invalid);
		assert.throws(() => compileCallableRustGraphPackageModel(invalid));
	}
});

test("Rust recursive packages reject public and private name collisions before compilation", () => {
	for(const name of ["LeanClosure", "Lease", "CallbackState", "CallbackFailure", "CallGuard", "FnMut", "Context0", "Callback0", "GraphNative", "assets", "Error"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.types.find(type => type.name === "Tree").name = name;
		assert.throws(() => compileCallableRustGraphPackageModel(ir), /reserved|duplicated|collides/, name);
	}
	for(const name of ["mod", "async", "dispatch", "invoke", "handle", "token", "assets", "graphRuntime", "graphReady", "graphRetire", "call0", "callback0", "invoke0", "copied", "callableStatus"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.declarations[0].name = name;
		assert.throws(() => compileCallableRustGraphPackageModel(ir), /reserved|duplicated|collides/, name);
	}
	const duplicate = nativeRecursiveCallableReviewedIr(); duplicate.declarations[1].name = duplicate.declarations[0].name;
	assert.throws(() => compileCallableRustGraphPackageModel(duplicate), /reserved|duplicated|collides/);
});
