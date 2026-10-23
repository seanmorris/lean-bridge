/**
 * Authenticate the callback-staging producer-replay repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackStagingProducerReplayRepairSource
	, callbackStagingProducerReplayRepairAddedPaths
	, callbackStagingProducerReplayRepairChangedPaths
	, callbackStagingProducerReplayRepairHistoryPath
	, callbackStagingProducerReplayRepairImplementation
	, callbackStagingProducerReplayRepairIntegrationPaths
	, callbackStagingProducerReplayRepairPredecessor
	, reverseCallbackStagingProducerReplayRepairUpdate
} from "./callback-staging-producer-replay-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback-staging producer replay repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackStagingProducerReplayRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-staging-producer-replay-repair-source-v1");
	assert.equal(record.predecessorCommit
		, callbackStagingProducerReplayRepairPredecessor);
	assert.equal(record.implementationCommit
		, callbackStagingProducerReplayRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackStagingProducerReplayRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackStagingProducerReplayRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackStagingProducerReplayRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackStagingProducerReplayRepairSource);
		const previous = git(["show"
			, `${callbackStagingProducerReplayRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackStagingProducerReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackStagingProducerReplayRepairSource);
		const previous = git(["show"
			, `${callbackStagingProducerReplayRepairImplementation}:${update.path}`]);
		assert.equal(reverseCallbackStagingProducerReplayRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback-staging producer replay repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackStagingProducerReplayRepairImplementation}^`]).trim()
	, callbackStagingProducerReplayRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackStagingProducerReplayRepairPredecessor
		, callbackStagingProducerReplayRepairImplementation])
		.trim().split("\n").sort()
	, [...callbackStagingProducerReplayRepairChangedPaths].sort());
});

test("callback-staging producer replay repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		callbackStagingProducerReplayRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackStagingProducerReplayRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackStagingProducerReplayRepairUpdate(
		current, update));
});

test("callback-staging producer replay writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-staging-producer-replay-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-staging-producer-replay-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
