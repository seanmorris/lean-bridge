/**
 * Authenticate owned checked-record npm/browser package retention.
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
	beforeOwnedCheckedRecordJavaScriptRetentionSource
	, ownedCheckedRecordJavaScriptRetentionAddedPaths
	, ownedCheckedRecordJavaScriptRetentionHistoryPath
	, ownedCheckedRecordJavaScriptRetentionImplementation
	, ownedCheckedRecordJavaScriptRetentionImplementationPaths
	, ownedCheckedRecordJavaScriptRetentionIntegrationPaths
	, ownedCheckedRecordJavaScriptRetentionModifiedPaths
	, ownedCheckedRecordJavaScriptRetentionPredecessor
	, reverseOwnedCheckedRecordJavaScriptRetentionUpdate
} from "./owned-checked-record-javascript-retention-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned checked-record JavaScript retention history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordJavaScriptRetentionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-javascript-retention-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordJavaScriptRetentionPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordJavaScriptRetentionImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordJavaScriptRetentionModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedRecordJavaScriptRetentionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordJavaScriptRetentionAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordJavaScriptRetentionSource);
		const previous = git(["show"
			, `${ownedCheckedRecordJavaScriptRetentionPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordJavaScriptRetentionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordJavaScriptRetentionSource);
		const previous = git(["show"
			, `${ownedCheckedRecordJavaScriptRetentionImplementation}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordJavaScriptRetentionUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned checked-record JavaScript retention history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedCheckedRecordJavaScriptRetentionImplementation}^`]).trim()
	, ownedCheckedRecordJavaScriptRetentionPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedRecordJavaScriptRetentionPredecessor
		, ownedCheckedRecordJavaScriptRetentionImplementation]).trim()
		.split("\n").sort()
	, [...ownedCheckedRecordJavaScriptRetentionImplementationPaths].sort());
});

test("owned checked-record JavaScript retention history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordJavaScriptRetentionHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeOwnedCheckedRecordJavaScriptRetentionSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedCheckedRecordJavaScriptRetentionUpdate(
		current, update));
});

test("owned checked-record JavaScript retention writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-checked-record-javascript-retention-history-"));
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
		"scripts/update-owned-checked-record-javascript-retention-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
