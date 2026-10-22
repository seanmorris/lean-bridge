/**
 * Authenticate the callback Subtype evidence-review repair history.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeCallbackSubtypeReviewRepairSource
	, callbackSubtypeReviewRepairAddedPaths
	, callbackSubtypeReviewRepairHistoryPath
	, callbackSubtypeReviewRepairImplementation
	, callbackSubtypeReviewRepairImplementationPaths
	, callbackSubtypeReviewRepairIntegrationPaths
	, callbackSubtypeReviewRepairModifiedPaths
	, callbackSubtypeReviewRepairPredecessor
	, reverseCallbackSubtypeReviewRepairUpdate
} from "./callback-subtype-review-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype review repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeReviewRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-review-repair-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeReviewRepairPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeReviewRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeReviewRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeReviewRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeReviewRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCallbackSubtypeReviewRepairSource);
		const previous = git(["show"
			, `${callbackSubtypeReviewRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeReviewRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCallbackSubtypeReviewRepairSource);
		const previous = git(["show"
			, `${callbackSubtypeReviewRepairImplementation}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeReviewRepairUpdate(current, update)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback Subtype review repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackSubtypeReviewRepairImplementation}^`]).trim()
	, callbackSubtypeReviewRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypeReviewRepairPredecessor
		, callbackSubtypeReviewRepairImplementation]).trim().split("\n").sort()
	, [...callbackSubtypeReviewRepairImplementationPaths].sort());
});

test("callback Subtype review repair rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeReviewRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCallbackSubtypeReviewRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCallbackSubtypeReviewRepairUpdate(current, update));
});

test("callback Subtype review writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-subtype-review-history-"));
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
		"scripts/update-callback-subtype-review-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
