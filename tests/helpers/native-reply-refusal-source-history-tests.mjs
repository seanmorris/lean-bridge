/**
 * Native reply refusal coverage and the support table preserve earlier source evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { beforeBrowserGenericPromotionSource } from "./browser-generic-promotion-source-history.mjs";
import { beforeNativeReplyRefusalSource, nativeReplyRefusalChangedPaths, nativeReplyRefusalHistoryPath, nativeReplyRefusalProducerCommit, nativeReplyRefusalProducerTestSha256, reverseNativeReplyRefusalUpdate } from "./native-reply-refusal-source-history.mjs";

test("native reply refusal history restores the exact executed intermediate only on an explicit identity request", async () => {
	const record = JSON.parse(await readFile(nativeReplyRefusalHistoryPath, "utf8"));
	assert.equal(record.producerCommit, nativeReplyRefusalProducerCommit);
	assert.equal(record.producerUpdates.length, 1);
	const [update] = record.producerUpdates, path = "tests/native-fin-callbacks.test.mjs";
	assert.equal(update.path, path); assert.equal(update.previousSha256, nativeReplyRefusalProducerTestSha256);
	const source = beforeBrowserGenericPromotionSource(path, await readFile(path, "utf8"));
	const restored = beforeNativeReplyRefusalSource(path, source, update.previousSha256);
	assert.equal(sha256(restored), nativeReplyRefusalProducerTestSha256);
	assert.equal(reverseNativeReplyRefusalUpdate(source, update), restored);
	assert.equal(beforeFinRefinementSource(path, source, update.previousSha256), restored);
	assert.notEqual(beforeNativeReplyRefusalSource(path, source), restored);
	assert.equal(beforeNativeReplyRefusalSource(path, restored, update.previousSha256), restored);
	assert.equal(beforeNativeReplyRefusalSource(path, source + "\n", update.previousSha256), source + "\n");
	assert.throws(() => reverseNativeReplyRefusalUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	assert.throws(() => reverseNativeReplyRefusalUpdate(source, { ...update, edits: [...update.edits, update.edits[0]] }));
});

test("Native reply refusal coverage authenticates each exact source predecessor", async () => {
	const record = JSON.parse(await readFile(nativeReplyRefusalHistoryPath, "utf8"));
	assert.equal(record.predecessorCommit, "bf89effc3735069b1f069482c26ccf296026e7db");
	assert.deepEqual(record.updates.map(update => update.path), nativeReplyRefusalChangedPaths);
	for(const update of record.updates)
	{
		const source = beforeBrowserGenericPromotionSource(update.path, await readFile(update.path, "utf8"));
		assert.equal(sha256(reverseNativeReplyRefusalUpdate(source, update)), update.previousSha256);
		assert.equal(sha256(beforeNativeReplyRefusalSource(update.path, source)), update.previousSha256);
		assert.equal(beforeNativeReplyRefusalSource(update.path, source, update.currentSha256), source);
		assert.equal(sha256(beforeFinRefinementSource(update.path, source, update.previousSha256)), update.previousSha256);
		const changed = source + "\n// unknown source change\n";
		assert.equal(beforeNativeReplyRefusalSource(update.path, changed), changed);
		assert.throws(() => reverseNativeReplyRefusalUpdate(changed, update));
		assert.throws(() => reverseNativeReplyRefusalUpdate(source, { ...update, previousSha256: "0".repeat(64) }));
	}
});

test("Native reply refusal coverage source pins do not change observations or other inventory claims", async () => {
	const path = "docs/type-surface.v1.json", text = beforeBrowserGenericPromotionSource(path, await readFile(path, "utf8"));
	const document = JSON.parse(text), previous = JSON.parse(beforeNativeReplyRefusalSource(path, text));
	const record = JSON.parse(await readFile(nativeReplyRefusalHistoryPath, "utf8"));
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && update.previousSha256 === file.sha256)
		{
			assert.equal(sha256(beforeBrowserGenericPromotionSource(file.path, await readFile(file.path, "utf8"))), update.currentSha256);
			file.sha256 = update.currentSha256; refreshed++;
		}
	}
	assert.equal(refreshed, 0);
	assert.deepEqual(document, previous);
});

test("the Native reply refusal coverage updater refuses another HEAD before any evidence write", async t => {
	const directory = await mkdtemp(join(tmpdir(), "lean-bridge-native-reply-refusal-history-guard-"));
	t.after(() => rm(directory, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: directory, stdio: "pipe", env });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated revision"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-reply-refusal-history.mjs")], { cwd: directory, encoding: "utf8", env });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Native reply refusal coverage history is draft-only at its exact predecessor/u);
	assert.deepEqual(await readdir(directory), [".git"]);
});
