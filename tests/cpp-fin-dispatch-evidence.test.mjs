/**
 * Keep the local installed C++ scalar Fin entry counters bound to both attempts, their exact transcripts and
 * producer sources, the published labels of each route and the separately attributed C rows (VO #1438).
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertCppDispatchArchive, assertCppDispatchRecords, cppDispatchDirectory, cppDispatchPaths, writeCppDispatchArtifact } from "./helpers/cpp-fin-dispatch-evidence.mjs";

const receiptSha256 = "228719e3edac773fd531367411ef5ed15f870d22d2e8d5ca2ba4b6ad975c11d3";
const receipt = async () => {
	const bytes = await readFile(`${cppDispatchDirectory}/receipt.json`);
	assert.equal(sha256(bytes), receiptSha256);
	return JSON.parse(bytes);
};
const records = async () => {
	const json = async name => JSON.parse(await readFile(`${cppDispatchDirectory}/${name}`));
	const text = name => readFile(`${cppDispatchDirectory}/${name}`, "utf8");
	return {
		succeeded: { queue: await json("succeeded/queue.json"), end: await json("succeeded/end.json"), tap: await text("succeeded/run.tap"), ordinary: await json("succeeded/native.json"), reviewed: await json("succeeded/native-reviewed.json") }
		, failed: { queue: await json("failed/queue.json"), end: await json("failed/end.json"), tap: await text("failed/run.tap"), ordinary: await json("failed/native.json") }
	};
};
const rehash = value => {
	value.succeeded.end.tapSha256 = sha256(value.succeeded.tap);
	value.failed.end.tapSha256 = sha256(value.failed.tap);
};

test("the C++ archive binds the corrected acceptance and its failed predecessor to exact sources", async () => {
	const value = await receipt();
	await assertCppDispatchArchive(value);
	assert.equal(value.artifacts.length, 47); assert.equal(value.sources.length, 33);
	assert.deepEqual(value.artifacts.map(file => file.path), cppDispatchPaths);
	assert.deepEqual([value.scope.hostedCi, value.scope.cppRawAdapterCaller, value.scope.localGlibc], [false, false, "2.36"]);
});

test("C++ records refuse altered labels, rows, counts, flags, routes and scope independently of hashes", async () => {
	const original = await records(); assertCppDispatchRecords(original);
	const reviewedCpp = value => value.succeeded.reviewed.reports[1], ordinaryCpp = value => value.succeeded.ordinary.reports[1];
	const mutations = [
		value => { reviewedCpp(value).dispatch.parameterNames.mirror = ["arg0"]; }
		, value => { reviewedCpp(value).dispatch.observed[1][1] = "invalid:1:1:arg0:10"; }
		, value => { ordinaryCpp(value).dispatch.observed[1][1] = "invalid:1:1:value0:10"; }
		, value => { ordinaryCpp(value).dispatch.observed[5][2][0] = 0; }
		, value => { ordinaryCpp(value).dispatch.observed.pop(); }
		, value => { ordinaryCpp(value).dispatch.missingInstrumentRejected = false; }
		, value => { ordinaryCpp(value).dispatch.repeatedColdProcess = false; }
		, value => { ordinaryCpp(value).dispatch.scope = "public and raw C++ calls"; }
		, value => { ordinaryCpp(value).dispatch.probeSha256 = "0".repeat(64); }
		, value => { ordinaryCpp(value).dispatch.libraries["lib/extra.so"] = { bytes: 1, sha256: "0".repeat(64) }; ordinaryCpp(value).dispatch.definers[0] = "lib/missing.so"; }
		, value => { ordinaryCpp(value).checks = 2019; }
		, value => { ordinaryCpp(value).relocatedInstallation = false; }
		, value => { value.succeeded.ordinary.reports[0].dispatch.observed[6][2][3] = 1; }
		, value => { value.succeeded.ordinary.reports[0].dispatch.runtimeTableChecks = 0; }
		, value => { value.succeeded.reviewed.reports.reverse(); }
		, value => { value.succeeded.reviewed = value.succeeded.ordinary; }
		, value => { value.succeeded.ordinary.archives[Object.keys(value.succeeded.ordinary.archives)[0]] = "0".repeat(64); }
		, value => { value.failed.ordinary.reports[1].dispatch.parameterNames = { mirror: ["arg0"] }; }
		, value => { ordinaryCpp(value).dispatch.observed[11][2][3] = 3; }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(original); mutate(value);
		assert.throws(() => assertCppDispatchRecords(value), assert.AssertionError);
	}
});

test("C++ records require each attempt's exact environment, outcome and transcript", async () => {
	const original = await records();
	const mutations = [
		value => { value.succeeded.queue.revision = value.failed.queue.revision; }
		, value => { value.succeeded.queue.sources["tests/helpers/cpp-fin-dispatch.mjs"] = "0".repeat(64); }
		, value => { value.succeeded.queue.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; }
		, value => { value.succeeded.queue.command = ["node", "--test"]; }
		, value => { value.succeeded.end.code = 1; }
		, value => { value.succeeded.end.stoppedForDisk = true; }
		, value => { value.failed.end.code = 0; }
		, value => { value.failed.queue.runnerSha256 = value.succeeded.queue.runnerSha256; }
		, value => { [value.succeeded, value.failed] = [value.failed, value.succeeded]; }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(original); mutate(value);
		assert.throws(() => assertCppDispatchRecords(value), assert.AssertionError);
	}
	// Rehash forged transcripts so these controls exercise their content, not the digest check.
	for(const [attempt, before, after] of [
		["succeeded", "# pass 2", "# pass 1"]
		, ["succeeded", "# skipped 0", "# skipped 1"]
		, ["succeeded", "ok 2 - independently reviewed", "not ok 2 - independently reviewed"]
		, ["failed", "value0 is not below its Fin 10 bound", "arg0 is not below its Fin 10 bound"]
		, ["failed", "# fail 1", "# fail 0"]
	]) {
		const value = structuredClone(original); value[attempt].tap = value[attempt].tap.replace(before, after);
		assert.notEqual(value[attempt].tap, original[attempt].tap, before); rehash(value);
		assert.throws(() => assertCppDispatchRecords(value), assert.AssertionError, before);
	}
});

test("the C++ archive rejects foreign, missing or extra paths and widened scope before opening any artifact", async () => {
	const original = await receipt();
	for(const mutate of [
		value => { value.artifacts[0].path = "../../outside.json"; }
		, value => { value.artifacts[0].path = "/tmp/foreign.json"; }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts.reverse(); }
		, value => { value.scope.hostedCi = true; }
		, value => { value.scope.cppRawAdapterCaller = true; }
		, value => { value.scope.localGlibc = "2.38"; }
		, value => { value.scope.failedAttempts = []; }
		, value => { value.sources.pop(); }
	]) {
		const value = structuredClone(original); mutate(value); let reads = 0;
		await assert.rejects(() => assertCppDispatchArchive(value, async path => { reads++; return readFile(path); }));
		assert.equal(reads, 0);
	}
});

test("the C++ archive rejects altered and rehashed bytes and relabelled provenance", async () => {
	const original = await receipt();
	for(const selected of [original.artifacts[0], original.artifacts[4], original.artifacts[9], original.artifacts.at(-1)])
	{
		const changed = Buffer.from(await readFile(selected.path)); changed[0] ^= 1;
		await assert.rejects(() => assertCppDispatchArchive(original, path => (path === selected.path ? Promise.resolve(changed) : readFile(path))));
		const value = structuredClone(original); value.artifacts.find(file => file.path === selected.path).sha256 = sha256(changed);
		await assert.rejects(() => assertCppDispatchArchive(value, path => (path === selected.path ? Promise.resolve(changed) : readFile(path))));
	}
	for(const mutate of [
		value => { value.artifacts[0].originalPath = "made-up/queue.json"; }
		, value => { value.artifacts[0].bytes--; }
		, value => { value.artifacts.at(-1).originalPath = "git:unknown:source.mjs"; }
	]) {
		const value = structuredClone(original); mutate(value);
		await assert.rejects(() => assertCppDispatchArchive(value));
	}
});

test("the C++ archive writer preserves originals and refuses differing replacement bytes", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-cpp-dispatch-writer-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "receipt.json"), bytes = Buffer.from("original\n");
	await writeCppDispatchArtifact(path, bytes); await writeCppDispatchArtifact(path, bytes);
	await assert.rejects(() => writeCppDispatchArtifact(path, Buffer.from("different\n")), /Refusing to replace/u);
	assert.deepEqual(await readFile(path), bytes);
});
