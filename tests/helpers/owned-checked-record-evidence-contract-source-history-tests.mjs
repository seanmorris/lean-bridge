/**
 * Authenticate the owned checked-record evidence-contract repair.
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
	beforeOwnedCheckedRecordEvidenceContractSource
	, ownedCheckedRecordEvidenceContractAddedPaths
	, ownedCheckedRecordEvidenceContractCommits
	, ownedCheckedRecordEvidenceContractHistoryPath
	, ownedCheckedRecordEvidenceContractImplementation
	, ownedCheckedRecordEvidenceContractImplementationPaths
	, ownedCheckedRecordEvidenceContractIntegrationPaths
	, ownedCheckedRecordEvidenceContractModifiedPaths
	, ownedCheckedRecordEvidenceContractPredecessor
	, reverseOwnedCheckedRecordEvidenceContractUpdate
} from "./owned-checked-record-evidence-contract-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned checked-record evidence contract restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordEvidenceContractHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-checked-record-evidence-contract-v1");
	assert.equal(record.predecessorCommit
		, ownedCheckedRecordEvidenceContractPredecessor);
	assert.equal(record.implementationCommit
		, ownedCheckedRecordEvidenceContractImplementation);
	assert.deepEqual(record.implementationCommits
		, ownedCheckedRecordEvidenceContractCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCheckedRecordEvidenceContractModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCheckedRecordEvidenceContractIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCheckedRecordEvidenceContractAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordEvidenceContractSource);
		const previous = git(["show"
			, `${ownedCheckedRecordEvidenceContractPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordEvidenceContractUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedCheckedRecordEvidenceContractSource);
		const previous = git(["show"
			, `${ownedCheckedRecordEvidenceContractImplementation}:${update.path}`]);
		assert.equal(reverseOwnedCheckedRecordEvidenceContractUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned checked-record evidence contract range is exact", () => {
	assert.deepEqual(git(["rev-list", "--reverse", "--ancestry-path"
		, `${ownedCheckedRecordEvidenceContractPredecessor}..${ownedCheckedRecordEvidenceContractImplementation}`]).trim().split("\n")
	, ownedCheckedRecordEvidenceContractCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCheckedRecordEvidenceContractPredecessor
		, ownedCheckedRecordEvidenceContractImplementation]).trim().split("\n").sort()
	, [...ownedCheckedRecordEvidenceContractImplementationPaths].sort());
});

test("owned checked-record evidence contract rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedCheckedRecordEvidenceContractHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedCheckedRecordEvidenceContractSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseOwnedCheckedRecordEvidenceContractUpdate(current, update));
});

test("owned checked-record evidence writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-checked-record-evidence-history-"));
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
		"scripts/update-owned-checked-record-evidence-contract-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
