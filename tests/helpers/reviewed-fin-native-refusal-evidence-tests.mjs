/**
 * Keep native fresh-Lean refusals bound to their actual controls, transcripts and producer sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertNativeRefusalArchive, assertNativeRefusalRecords, nativeRefusalDirectory, nativeRefusalPaths, writeNativeRefusalArtifact } from "./reviewed-fin-native-refusal-evidence.mjs";

const receipt = async () => JSON.parse(await readFile(`${nativeRefusalDirectory}/receipt.json`));
const records = async () => {
	const json = async name => JSON.parse(await readFile(`${nativeRefusalDirectory}/${name}.json`));
	return { queue: await json("queue"), end: await json("end")
		, tap: await readFile(`${nativeRefusalDirectory}/run.tap`, "utf8")
		, reports: [await json("native-fin"), await json("fin-containers")] };
};

test("native refusal archive binds both publishing controls and nineteen fresh-Lean refusals to exact sources", async () => {
	const bytes = await readFile(`${nativeRefusalDirectory}/receipt.json`);
	assert.equal(sha256(bytes), "347caed7fe4d4dbd732518fafc0bbd6191d71b0dbde40ad1c6ab03daa49633e1");
	const value = JSON.parse(bytes);
	await assertNativeRefusalArchive(value);
	assert.equal(value.artifacts.length, 22); assert.equal(value.sources.length, 14);
	assert.deepEqual(value.artifacts.map(file => file.path), nativeRefusalPaths);
});

test("native refusal records reject missing, mislabeled and invented compiler observations independently of hashes", async () => {
	const original = await records(); assertNativeRefusalRecords(original);
	const mutations = [
		value => { value.reports.pop(); }
		, value => { value.reports.reverse(); }
		, value => { value.reports[0].control.published = false; }
		, value => { value.reports[0].control.reviewSha256 = "0".repeat(64); }
		, value => { value.reports[0].control.bindingIrSha256 = "0".repeat(64); }
		, value => { value.reports[1].target = "cpp"; }
		, value => { value.reports[1].cases.pop(); }
		, value => { value.reports[1].cases.push(value.reports[1].cases[0]); }
		, value => { value.reports[1].cases[0].field += ".other"; }
		, value => { value.reports[1].cases[0].code = "invalid-reviewed-input"; }
		, value => { value.reports[1].cases[0].reviewSha256 = "0".repeat(64); }
		, value => { value.reports[1].cases[0].releaseRoot = "EACCES"; }
		, value => { value.reports[0].cases[0].label = "invented case"; }
		, value => { value.reports[0].dispatch = "observed"; }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(original); mutate(value);
		assert.throws(() => assertNativeRefusalRecords(value));
	}
});

test("native refusal records require the selected environment and complete unskipped successful transcript", async () => {
	const original = await records();
	const mutations = [
		value => { value.queue.revision = "0".repeat(40); }
		, value => { value.queue.sources["src/build/native-model.mjs"] = "0".repeat(64); }
		, value => { value.queue.command = ["node", "--test"]; }
		, value => { value.queue.environment.LEAN_BRIDGE_REVIEWED_FIN_REFUSALS = "native-fin"; }
		, value => { value.queue.environment.LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR = "2.38"; }
		, value => { value.queue.lean = "unknown compiler"; }
		, value => { value.end.code = 1; }
		, value => { value.end.signal = "SIGTERM"; }
		, value => { value.end.stoppedForDisk = true; }
		, value => { value.end.minimumFreeMiB = 0; }
		, value => { value.end.tapSha256 = "0".repeat(64); }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(original); mutate(value);
		assert.throws(() => assertNativeRefusalRecords(value));
	}
	// Rehash a forged transcript so these controls exercise its content, not the digest check.
	for(const [before, after] of [
		["# pass 23", "# pass 22"], ["# skipped 0", "# skipped 1"]
		, ["    ok 1 - wrong scalar bound", "    not ok 1 - wrong scalar bound"]
		, ["    ok 1 - wrong scalar bound", "    ok 1 - wrong scalar bound # SKIP"]
		, ["    ok 9 - omitted alias bound", "    ok 9 - another alias"]
		, ["ok 3 - changed native-fin reviews are refused against fresh Lean beside a publishing control", "ok 3 - changed native-fin reviews are refused against fresh Lean beside a publishing control # SKIP"]
	]) {
		const value = structuredClone(original); value.tap = value.tap.replace(before, after);
		assert.notEqual(value.tap, original.tap); value.end.tapSha256 = sha256(value.tap);
		assert.throws(() => assertNativeRefusalRecords(value));
	}
});

test("native refusal archive rejects foreign paths and widened scope before opening any artifact", async () => {
	const original = await receipt();
	const mutations = [
		value => { value.artifacts[0].path = "../../outside.json"; }
		, value => { value.artifacts[0].path = "/tmp/foreign.json"; }
		, value => { value.artifacts.push(value.artifacts[0]); }
		, value => { value.artifacts.pop(); }
		, value => { value.artifacts.reverse(); }
		, value => { value.scope.hostedCi = true; }
		, value => { value.scope.installedConsumerEvidence = true; }
		, value => { value.scope.entryCounterEvidence = true; }
		, value => { value.scope.target = "cpp"; }
		, value => { value.sources.pop(); }
	];
	for(const mutate of mutations)
	{
		const value = structuredClone(original); mutate(value); let reads = 0;
		await assert.rejects(() => assertNativeRefusalArchive(value, async path => { reads++; return readFile(path); }));
		assert.equal(reads, 0);
	}
});

test("native refusal archive rejects altered bytes, rehashed reports and relabeled source provenance", async () => {
	const original = await receipt();
	for(const selected of [original.artifacts[0], original.artifacts[3], original.artifacts.at(-1)])
	{
		const changed = Buffer.from(await readFile(selected.path)); changed[0] ^= 1;
		await assert.rejects(() => assertNativeRefusalArchive(original, path => path === selected.path ? Promise.resolve(changed) : readFile(path)));
		const value = structuredClone(original); value.artifacts.find(file => file.path === selected.path).sha256 = sha256(changed);
		await assert.rejects(() => assertNativeRefusalArchive(value, path => path === selected.path ? Promise.resolve(changed) : readFile(path)));
	}
	for(const mutate of [
		value => { value.artifacts[0].originalPath = "made-up/queue.json"; }
		, value => { value.artifacts[0].bytes--; }
		, value => { value.artifacts.at(-1).originalPath = "git:unknown:source.mjs"; }
	]) {
		const value = structuredClone(original); mutate(value);
		await assert.rejects(() => assertNativeRefusalArchive(value));
	}
});

test("native refusal archive writer preserves originals and refuses differing replacement bytes", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-refusal-writer-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const path = join(root, "receipt.json"), bytes = Buffer.from("original\n");
	await writeNativeRefusalArtifact(path, bytes); await writeNativeRefusalArtifact(path, bytes);
	await assert.rejects(() => writeNativeRefusalArtifact(path, Buffer.from("different\n")), /Refusing to replace/u);
	assert.deepEqual(await readFile(path), bytes);
});
