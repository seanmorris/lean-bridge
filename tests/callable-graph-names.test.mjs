/**
 * Reject collisions in the actual callable consumer API before compilation.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { compileCallableGraphPackageModel } from "../src/backends/c/callable-graph-model.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";

test("recursive C callbacks cannot shadow copied values, runtime helpers or another callback's helpers", () => {
	for(const name of ["Status", "Error", "ErrorCode", "Initialize", "GraphReady", "GraphRetire", "GraphInitialize", "GraphFinish", "Runtime", "RuntimeV1", "PayloadT", "PayloadT_copy", "ScalarNatT_copy", "CallArray", "OwnedEcho", "OwnedEchoCall", "OwnedEchoDispose", "EchoFn", "GmpEcho", "GmpEchoFn", "GmpOwnedEcho"])
	{
		const ir = nativeRecursiveCallableReviewedIr(), callbacks = ir.types.filter(type => type.kind === "callback");
		callbacks[0].name = "Echo"; callbacks[1].name = name;
		for(const targets of [["c"], ["c", "cpp"]])
			assert.throws(() => compileCallableGraphPackageModel(ir, targets), /collision|collides/, name);
	}
	for(const name of ["Echo", "echo", "ECHO"])
	{
		const ir = nativeRecursiveCallableReviewedIr(), callbacks = ir.types.filter(type => type.kind === "callback");
		callbacks[0].name = "Echo"; callbacks[1].name = name;
		assert.throws(() => compileCallableGraphPackageModel(ir, ["c"]), /collision|collides/, name);
	}
});

test("recursive C export names include callback helpers and deep-copy helpers in their collision checks", () => {
	for(const name of ["echo", "echoFn", "ownedEcho", "ownedEchoCall", "ownedEchoDispose", "gmpEcho", "gmpOwnedEcho", "payload_t_copy"])
	{
		const ir = nativeRecursiveCallableReviewedIr();
		ir.types.find(type => type.kind === "callback").name = "Echo";
		ir.declarations[0].name = name;
		assert.throws(() => compileCallableGraphPackageModel(ir, ["c"]), /collision|collides/, name);
	}
});

test("recursive C declared errors cannot override built-ins or collide after normalization", () => {
	for(const name of ["None", "InvalidArgument", "RuntimeUnavailable", "Unexpected"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.errors[0].name = name;
		assert.throws(() => compileCallableGraphPackageModel(ir, ["c"]), /declared error name collides/, name);
		assert.doesNotThrow(() => compileCallableGraphPackageModel(ir, ["cpp"]));
	}
	const ir = nativeRecursiveCallableReviewedIr();
	ir.errors.push({ ...ir.errors[0], id: "error:SecondFailure", name: "native_callback_failure" });
	assert.throws(() => compileCallableGraphPackageModel(ir, ["c"]), /declared error name collides/);
	const variant = nativeRecursiveCallableReviewedIr();
	variant.types.find(type => type.name === "Tree").name = "Error";
	variant.errors[0].name = "T_kind_leaf";
	assert.throws(() => compileCallableGraphPackageModel(variant, ["c"]), /declared error name collides/);
});

test("recursive callable admission checks names in the requested target namespace", () => {
	for(const name of ["Error", "LeanClosure", "detail", "std", "boost"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.types[0].name = name;
		assert.doesNotThrow(() => compileCallableGraphPackageModel(ir, ["c"]), name);
		assert.throws(() => compileCallableGraphPackageModel(ir, ["cpp"]), /reserved|collides/, name);
	}
	for(const name of ["detail", "std", "boost"])
	{
		const ir = nativeRecursiveCallableReviewedIr(); ir.declarations[0].name = name;
		assert.doesNotThrow(() => compileCallableGraphPackageModel(ir, ["c"]), name);
		assert.throws(() => compileCallableGraphPackageModel(ir, ["cpp"]), /reserved|collides/, name);
	}
});
