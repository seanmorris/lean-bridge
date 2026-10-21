/**
 * Keep CI partition history exact and preserve earlier evidence and support claims.
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
import { beforeNativeConsumerPartitionSource, nativeConsumerPartitionChangedPaths, nativeConsumerPartitionHistoryPath, nativeConsumerPartitionPredecessor, reverseNativeConsumerPartitionUpdate } from "./native-consumer-partition-history.mjs";
import { sourceAtHistoryMilestone } from "./source-history-test-source.mjs";

test("native CI partition history authenticates every exact predecessor and preserves all support claims", async t => {
	const record = JSON.parse(await readFile(nativeConsumerPartitionHistoryPath));
	assert.equal(record.schemaVersion, 1); assert.equal(record.milestone, "native-consumer-partition-source-v1");
	assert.equal(record.predecessorCommit, nativeConsumerPartitionPredecessor);
	assert.deepEqual(record.updates.map(update => update.path), nativeConsumerPartitionChangedPaths);
	const original = path => execFileSync("git", ["show", `${nativeConsumerPartitionPredecessor}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	for(const update of record.updates)
	{
		const source = sourceAtHistoryMilestone(
			nativeConsumerPartitionHistoryPath, update.path
		);
		const previous = reverseNativeConsumerPartitionUpdate(source, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeNativeConsumerPartitionSource(update.path, source), previous);
		assert.equal(beforeNativeConsumerPartitionSource(update.path, source, update.currentSha256), source);
		assert.equal(beforeFinRefinementSource(update.path, source, update.previousSha256), previous);
		assert.equal(beforeNativeConsumerPartitionSource(update.path, source + "unknown"), source + "unknown");
		const mutations = [item => { item.path = "unknown"; }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.edits = []; }, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNativeConsumerPartitionUpdate(source, changed));
		}
	}
	const path = "docs/type-surface.v1.json", expected = JSON.parse(original(path));
	assert.equal(expected.evidence.length, 500); assert.equal(expected.observations.length, 585);
	let pins = 0;
	for(const evidence of expected.evidence) for(const file of evidence.files)
	{
		const update = record.updates.find(update => update.path === file.path && update.previousSha256 === file.sha256);
		if(update)
		{ file.sha256 = update.currentSha256; pins++; }
	}
	assert.ok(pins > 0);
	const checkpoint = record.updates.find(update => update.path === path).currentSha256;
	assert.deepEqual(JSON.parse(beforeNativeConsumerPartitionSource(
		path, sourceAtHistoryMilestone(nativeConsumerPartitionHistoryPath, path)
		, checkpoint
	)), expected);
	for(const evidence of expected.evidence) for(const file of evidence.files)
		assert.equal(sha256(beforeFinRefinementSource(file.path, await readFile(file.path), file.sha256)), file.sha256, file.path);
	t.diagnostic(`${pins} source pins refreshed; every support claim and observation unchanged`);
});

test("native CI partition history writer refuses unrelated HEAD before writing", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-native-ci-partition-history-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve("scripts/update-native-consumer-partition-history.mjs")], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /draft-only/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
