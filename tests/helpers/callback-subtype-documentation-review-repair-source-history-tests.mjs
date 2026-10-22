/**
 * Authenticate the callback Subtype documentation review repair.
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
	beforeCallbackSubtypeDocumentationReviewRepairSource
	, callbackSubtypeDocumentationReviewRepairAddedPaths
	, callbackSubtypeDocumentationReviewRepairHistoryPath
	, callbackSubtypeDocumentationReviewRepairImplementation
	, callbackSubtypeDocumentationReviewRepairImplementationPaths
	, callbackSubtypeDocumentationReviewRepairIntegrationPaths
	, callbackSubtypeDocumentationReviewRepairModifiedPaths
	, callbackSubtypeDocumentationReviewRepairPredecessor
	, reverseCallbackSubtypeDocumentationReviewRepairUpdate
} from "./callback-subtype-documentation-review-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype documentation review repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeDocumentationReviewRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-subtype-documentation-review-repair-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeDocumentationReviewRepairPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeDocumentationReviewRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeDocumentationReviewRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeDocumentationReviewRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeDocumentationReviewRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeDocumentationReviewRepairSource);
		const previous = git(["show"
			, `${callbackSubtypeDocumentationReviewRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeDocumentationReviewRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeDocumentationReviewRepairSource);
		const previous = git(["show"
			, `${callbackSubtypeDocumentationReviewRepairImplementation}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeDocumentationReviewRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback Subtype documentation review repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackSubtypeDocumentationReviewRepairImplementation}^`]).trim()
	, callbackSubtypeDocumentationReviewRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypeDocumentationReviewRepairPredecessor
		, callbackSubtypeDocumentationReviewRepairImplementation]).trim().split("\n").sort()
	, [...callbackSubtypeDocumentationReviewRepairImplementationPaths].sort());
});

test("callback Subtype documentation review repair rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeDocumentationReviewRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackSubtypeDocumentationReviewRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCallbackSubtypeDocumentationReviewRepairUpdate(current, update));
});

test("callback Subtype documentation review writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-subtype-doc-review-history-"));
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
		"scripts/update-callback-subtype-documentation-review-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
