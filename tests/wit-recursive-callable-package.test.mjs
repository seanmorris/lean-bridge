/**
 * Recursive callable WIT package admission and original archive consumption.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson } from "../src/capsule/node.mjs";
import { compileCallableWitGraphPackageModel } from "../src/backends/wit/callable-graph-package.mjs";
import { compileNativeGraphProjection } from "../src/build/native-graph-projection.mjs";
import { nativeRecursiveCallableReviewedIr } from "./helpers/native-recursive-callable-fixture.mjs";
import { saveLakeFile } from "./helpers/lake-workspace.mjs";

test("recursive callable WIT packages expose stable copied aliases and typed registration", () => {
	const ir = nativeRecursiveCallableReviewedIr(), original = canonicalJson(ir);
	const model = compileCallableWitGraphPackageModel(ir);
	assert.equal(canonicalJson(ir), original);
	assert.equal(model.manifest.cHost.values.length, 33);
	assert.equal(model.manifest.cHost.callbacks.length, 18);
	assert.equal(model.prefix, "structured"); assert.equal(model.callableGraph, true);
	assert.equal(compileNativeGraphProjection(ir, ["wit-wasi"]).layoutSha256, model.layoutSha256);
	for(const target of ["c", "cpp", "pypi", "cargo", "rubygems", "nuget", "maven", "php-native"])
		assert.equal(compileNativeGraphProjection(ir, [target, "wit-wasi"]).layoutSha256, model.layoutSha256);
	assert.equal(compileNativeGraphProjection(ir, ["cpan", "wit-wasi"], "LeanBridge::Structured").layoutSha256, model.layoutSha256);
	assert.match(model.hostHeader, /structured_call_array_argument0_t/);
	assert.match(model.hostHeader, /structured_alias_t_wasmtime_copy/);
	assert.match(model.hostHeader, /structured_payload_rows_t_clear/);
	assert.match(model.hostHeader, /structured_wasmtime_call_recursive_callback1_create/);
	assert.match(model.hostHeader, /structured_wasmtime_make_recursive_call/);
	assert.equal(model.hostHeader, compileCallableWitGraphPackageModel(ir).hostHeader);
	assert.throws(() => compileCallableWitGraphPackageModel(ir, { name: "../../escape" }), /coordinate/);
	const collision = structuredClone(ir);
	const owned = model.functions.find(fn => fn.declaration.name === "makeRecursive").result;
	collision.declarations.find(fn => fn.name === "makeRecursive").name = "function_" + owned.publicName.slice(model.prefix.length + 1);
	assert.throws(() => compileCallableWitGraphPackageModel(collision), /WIT callable helper name collision/);
});

test("recursive callable WIT archives execute after removing author and install sources", {
	skip: process.env.LEAN_BRIDGE_WIT_RECURSIVE_CALLABLE_INSTALLED_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-recursive-installed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkWitRecursiveCallablePackages } = await import("./helpers/wit-recursive-callable-packages.mjs");
	const report = await checkWitRecursiveCallablePackages(root, message => t.diagnostic(message));
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	await saveLakeFile("build/recursive-callables", "wit-packages.json", canonicalJson(report));
});

test("mixed recursive WIT archives retain nineteen primitives and wide Unit callbacks", {
	skip: process.env.LEAN_BRIDGE_WIT_RECURSIVE_CALLABLE_MIXED_TEST !== "1"
	, timeout: 1_200_000
}, async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-wit-recursive-mixed-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const { checkWitRecursiveCallablePackages } = await import("./helpers/wit-recursive-callable-packages.mjs");
	const report = await checkWitRecursiveCallablePackages(root, message => t.diagnostic(message), { mixed: true });
	assert.deepEqual(report.observations.map(run => run.reviewed), [false, true]);
	await saveLakeFile("build/recursive-callables", "wit-mixed-packages.json", canonicalJson(report));
});
