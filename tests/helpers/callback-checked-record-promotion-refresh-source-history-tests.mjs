/**
 * Authenticate the retained callback checked-record promotion refresh.
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
	beforeCallbackCheckedRecordPromotionRefreshSource
	, callbackCheckedRecordPromotionRefreshAddedPaths
	, callbackCheckedRecordPromotionRefreshApplicationAddedPaths
	, callbackCheckedRecordPromotionRefreshChangedPaths
	, callbackCheckedRecordPromotionRefreshHistoryPath
	, callbackCheckedRecordPromotionRefreshImplementation
	, callbackCheckedRecordPromotionRefreshIntegrationPaths
	, callbackCheckedRecordPromotionRefreshPredecessor
	, reverseCallbackCheckedRecordPromotionRefreshUpdate
} from "./callback-checked-record-promotion-refresh-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback checked-record promotion refresh restores every source"
	, async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordPromotionRefreshHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-checked-record-promotion-refresh-source-v1");
	assert.equal(record.predecessorCommit
		, callbackCheckedRecordPromotionRefreshPredecessor);
	assert.equal(record.implementationCommit
		, callbackCheckedRecordPromotionRefreshImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackCheckedRecordPromotionRefreshChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackCheckedRecordPromotionRefreshIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackCheckedRecordPromotionRefreshAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackCheckedRecordPromotionRefreshSource);
		const previous = git(["show"
			, `${callbackCheckedRecordPromotionRefreshPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackCheckedRecordPromotionRefreshUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackCheckedRecordPromotionRefreshSource);
		const previous = git(["show"
			, `${callbackCheckedRecordPromotionRefreshImplementation}:${update.path}`]);
		assert.equal(reverseCallbackCheckedRecordPromotionRefreshUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
	}
);

test("callback checked-record promotion refresh range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackCheckedRecordPromotionRefreshImplementation}^`]).trim()
	, callbackCheckedRecordPromotionRefreshPredecessor);
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
		, callbackCheckedRecordPromotionRefreshPredecessor
		, callbackCheckedRecordPromotionRefreshImplementation])
		.trim().split("\n").sort()
	, [...callbackCheckedRecordPromotionRefreshChangedPaths].sort());
	assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
		, callbackCheckedRecordPromotionRefreshPredecessor
		, callbackCheckedRecordPromotionRefreshImplementation])
		.trim().split("\n").sort()
	, [...callbackCheckedRecordPromotionRefreshApplicationAddedPaths].sort());
});

test("callback checked-record promotion refresh rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordPromotionRefreshHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackCheckedRecordPromotionRefreshSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackCheckedRecordPromotionRefreshUpdate(
		current, update));
});

test("callback checked-record promotion refresh writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-record-promotion-refresh-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-checked-record-promotion-refresh-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
