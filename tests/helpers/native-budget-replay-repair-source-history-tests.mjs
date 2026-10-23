/**
 * Authenticate the exact-history native-budget replay repair.
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
	beforeNativeBudgetReplayRepairSource
	, nativeBudgetReplayRepairAddedPaths
	, nativeBudgetReplayRepairChangedPaths
	, nativeBudgetReplayRepairHistoryPath
	, nativeBudgetReplayRepairImplementation
	, nativeBudgetReplayRepairIntegrationPaths
	, nativeBudgetReplayRepairPredecessor
	, reverseNativeBudgetReplayRepairUpdate
} from "./native-budget-replay-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("native budget replay repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		nativeBudgetReplayRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "native-budget-replay-repair-source-v1");
	assert.equal(record.predecessorCommit, nativeBudgetReplayRepairPredecessor);
	assert.equal(record.implementationCommit, nativeBudgetReplayRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, nativeBudgetReplayRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, nativeBudgetReplayRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, nativeBudgetReplayRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeNativeBudgetReplayRepairSource);
		const previous = git(["show"
			, `${nativeBudgetReplayRepairPredecessor}:${update.path}`]);
		assert.equal(reverseNativeBudgetReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeNativeBudgetReplayRepairSource);
		const previous = git(["show"
			, `${nativeBudgetReplayRepairImplementation}:${update.path}`]);
		assert.equal(reverseNativeBudgetReplayRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("native budget replay repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${nativeBudgetReplayRepairImplementation}^`]).trim()
	, nativeBudgetReplayRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, nativeBudgetReplayRepairPredecessor
		, nativeBudgetReplayRepairImplementation])
		.trim().split("\n").sort()
	, [...nativeBudgetReplayRepairChangedPaths].sort());
});

test("native budget replay repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		nativeBudgetReplayRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeNativeBudgetReplayRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseNativeBudgetReplayRepairUpdate(current, update));
});

test("native budget replay writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-native-budget-replay-repair-"));
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
		"scripts/update-native-budget-replay-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
