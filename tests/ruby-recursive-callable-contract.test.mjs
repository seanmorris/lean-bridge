/**
 * Recursive Ruby callbacks, shared native layouts and safe public names.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCallableRubyGraphPackageModel } from "../src/backends/ruby/callable-graph-model.mjs";
import { generateCallableRubyGraphPackage } from "../src/backends/ruby/callable-graph-package.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { compileCallableGraphPackageModel } from "../src/backends/c/callable-graph-model.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { auditManagedBindingPackage } from "../src/backends/managed/package-audit.mjs";

test("Ruby recursive callbacks preserve the checked graph and hide native storage", () => {
	const ir = nativeRecursiveCallableReviewedIr(), before = structuredClone(ir);
	const model = compileCallableRubyGraphPackageModel(ir), files = generateCallableRubyGraphPackage(ir);
	assert.deepEqual(ir, before); assert.deepEqual(generateCallableRubyGraphPackage(ir), files);
	assert.equal(model.layoutSha256, compileCallableGraphPackageModel(ir, ["c", "cpp"]).layoutSha256);
	assert.equal(model.functions.length, 33); assert.equal(model.callbacks.size, 18);
	assert.equal(auditManagedBindingPackage(ir, files, "ruby").publicFiles.length, 1);
	assert.match(files["lib/lean_bridge/structured.rb"], /def call_recursive\(arg0, \*callback, &block\)/);
	assert.match(files["lib/lean_bridge/structured.rb"], /class LeanClosure/);
	assert.doesNotMatch(files["lib/lean_bridge/structured.rb"], /\bFiddle\b|TYPE_VOIDP|lease_call|lease_dispose/);
	assert.match(files["lib/lean_bridge/structured/native.rb"], /@nonlocal_failure = LocalJumpError.new/);
	assert.match(files["lib/lean_bridge/structured/native.rb"], /EXACT.bind_call\(failure, GraphInvalidNative\)/);
});

test("RubyGems recursive callbacks agree with every selected supported native target", () => {
	const ir = nativeRecursiveCallableReviewedIr(), expected = compileCallableRubyGraphPackageModel(ir).layoutSha256;
	for(const targets of [["rubygems"], ["rubygems", "c"], ["cpp", "rubygems"], ["pypi", "rubygems"], ["cargo", "rubygems"], ["nuget", "rubygems"], ["rubygems", "maven"], ["rubygems", "c", "cpp", "pypi", "cargo", "nuget", "maven"]])
		assert.equal(compileNativeGraphProjection(ir, targets).layoutSha256, expected);
	for(const targets of [["rubygems", "cpan"], ["rubygems", "c", "cpp", "pypi", "cargo", "cpan"]])
		assert.equal(compileNativeGraphProjection(ir, targets, "LeanBridge::Recursive").layoutSha256, expected);
	for(const targets of [[], ["rubygems", "rubygems"], ["rubygems", "cpan"], ["unknown"]])
		assert.throws(() => compileNativeGraphProjection(ir, targets), { code: "native-graph-projection-unavailable" });
});

test("Ruby recursive callbacks reject hidden identities and asynchronous delivery", () => {
	for(const change of [
		ir => { ir.types.find(type => type.kind === "callback").callable.resultMode = "promise"; }
		, ir => { ir.types.find(type => type.kind === "callback").callable.parameters[0].ownership = "borrow"; }
		, ir => { ir.types.find(type => type.name === "Payload").fields[0].type = { kind: "named", id: ir.types.find(type => type.kind === "callback").id }; }
	]) {
		const ir = nativeRecursiveCallableReviewedIr(); change(ir);
		assert.throws(() => compileCallableRubyGraphPackageModel(ir));
	}
});

test("Ruby recursive packages reject reserved and duplicate public names", () => {
	for(const name of ["LeanClosure", "Native", "Some", "Object", "Fiddle", "Thread", "LocalJumpError"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.types.find(type => type.name === "Tree").name = name;
		assert.throws(() => compileCallableRubyGraphPackageModel(ir), /reserved|duplicat|collid/i);
	}
	for(const name of ["class", "module", "def", "end", "send", "new", "raise", "initialize", "methodMissing"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.declarations[0].name = name;
		assert.throws(() => compileCallableRubyGraphPackageModel(ir), /reserved|duplicat|collid/i);
	}
	const ir = nativeRecursiveCallableReviewedIr(); ir.declarations[1].name = ir.declarations[0].name;
	assert.throws(() => compileCallableRubyGraphPackageModel(ir));
});
