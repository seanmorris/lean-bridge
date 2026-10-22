/**
 * Authenticate the owned checked-record hosted archiver change.
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
	beforeOwnedCheckedRecordHostedArchiversSource
	, ownedCheckedRecordHostedArchiversAddedPaths
	, ownedCheckedRecordHostedArchiversHistoricalAdditions
	, ownedCheckedRecordHostedArchiversHistoryPath
	, ownedCheckedRecordHostedArchiversHistoryParent
	, ownedCheckedRecordHostedArchiversImplementation
	, ownedCheckedRecordHostedArchiversImplementationPaths
	, ownedCheckedRecordHostedArchiversIntegrationBase
	, ownedCheckedRecordHostedArchiversIntegrationPredecessor
	, ownedCheckedRecordHostedArchiversIntegrationPaths
	, ownedCheckedRecordHostedArchiversModifiedPaths
	, ownedCheckedRecordHostedArchiversPredecessor
	, reverseOwnedCheckedRecordHostedArchiversUpdate
} from "./owned-checked-record-hosted-archivers-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned checked-record hosted archiver history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordHostedArchiversHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-hosted-archivers-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordHostedArchiversPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordHostedArchiversImplementation);
	assert.equal(record.integrationPredecessorCommit
		, ownedCheckedRecordHostedArchiversIntegrationPredecessor);
	assert.equal(record.historyParentCommit
		, ownedCheckedRecordHostedArchiversHistoryParent);
	assert.deepEqual(record.historicalUpdates.map(item => item.path)
		, ownedCheckedRecordHostedArchiversModifiedPaths);
	assert.deepEqual(record.historicalAdditions.map(item => item.path)
		, ownedCheckedRecordHostedArchiversHistoricalAdditions);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedRecordHostedArchiversIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordHostedArchiversAddedPaths);
	for(const update of record.historicalUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordHostedArchiversSource);
		const previous = git(["show"
			, `${ownedCheckedRecordHostedArchiversPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordHostedArchiversUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.historicalAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordHostedArchiversPredecessor
			, "--", addition.path]).trim(), "", addition.path);
		assert.equal(sha256(git(["show"
			, `${ownedCheckedRecordHostedArchiversImplementation}:${addition.path}`]))
		, addition.currentSha256, addition.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordHostedArchiversSource);
		const previous = git(["show"
			, `${ownedCheckedRecordHostedArchiversIntegrationBase(update.path)}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordHostedArchiversUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned checked-record hosted archiver history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedCheckedRecordHostedArchiversImplementation}^`]).trim()
	, ownedCheckedRecordHostedArchiversPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedRecordHostedArchiversPredecessor
		, ownedCheckedRecordHostedArchiversImplementation]).trim().split("\n").sort()
	, [...ownedCheckedRecordHostedArchiversImplementationPaths].sort());
});

test("owned checked-record hosted archiver history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordHostedArchiversHistoryPath, "utf8"));
	const update = structuredClone(record.historicalUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeOwnedCheckedRecordHostedArchiversSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseOwnedCheckedRecordHostedArchiversUpdate(current, update));
});

test("owned checked-record hosted archiver history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-checked-record-hosted-archivers-history-"));
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
		"scripts/update-owned-checked-record-hosted-archivers-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
