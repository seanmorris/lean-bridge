/**
 * Native recursive conversion checks do not promote installed coverage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { generateNativeCopiedGraphAdapters } from "../src/backends/c/native-graph-adapters.mjs";
import { recursiveCarrierAbi } from "./helpers/recursive-carriers.mjs";
import { recursiveReviewedIr } from "./helpers/recursive-fixture.mjs";
import { checkNativeRecursiveTransport } from "./helpers/native-recursive-transport.mjs";

test("native recursive transport authenticates carrier identities before emitting C", () => {
	const ir = recursiveReviewedIr(), abi = recursiveCarrierAbi(ir);
	const output = generateNativeCopiedGraphAdapters(ir, abi);
	assert.match(output.source, /ng_enter/); assert.match(output.source, /ng_allocate/);
	assert.match(output.source, /__attribute__\(\(noinline\)\)/u);
	assert.doesNotMatch(output.source, /lean_ctor_get|lean_ctor_set|lean_alloc_ctor/u);
	const changed = structuredClone(abi); changed.types.find(type => type.id === "lean:Recursive.Spine").cases.reverse();
	assert.throws(() => generateNativeCopiedGraphAdapters(ir, changed), /nominal definitions differ/u);
	const checked = generateNativeCopiedGraphAdapters(ir, abi, { initializer: "initialize_LeanBridgeNative0123456789abcdef" });
	assert.match(checked.source, /NG_RUNTIME = 5/u);
	assert.match(checked.source, /if \(status == NG_RESULT\) lean_bridge_native_runtime_retire\(\)/u);
	assert.match(checked.source, /if \(!ng_ready\(\)\) \{ ng_release\(arena.head\); return NG_RUNTIME; \}/u);
	assert.doesNotMatch(output.source, /lean_bridge_native_runtime_retire/u);
	assert.throws(() => generateNativeCopiedGraphAdapters(ir, abi, { initializer: "initialize_other" }), /initializer identity/u);
});

test("fresh native recursive graphs validate, copy and recover with total Lean carriers", {
	skip: process.env.LEAN_BRIDGE_NATIVE_RECURSIVE_TEST !== "1", timeout: 600000
}, async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-native-recursive-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const result = await checkNativeRecursiveTransport(directory);
	assert.ok(result.checks > 100000); assert.equal(result.exports, 18); assert.equal(result.width, 255);
	t.diagnostic(`Executed ${result.checks} native recursive checks with ${result.exports} compiled exports.`);
});
