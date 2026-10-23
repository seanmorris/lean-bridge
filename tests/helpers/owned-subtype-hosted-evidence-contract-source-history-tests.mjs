/**
 * Authenticate the owned Subtype hosted-evidence contract transition.
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
	beforeOwnedSubtypeHostedEvidenceContractSource
	, ownedSubtypeHostedEvidenceContractAddedPaths
	, ownedSubtypeHostedEvidenceContractCommits
	, ownedSubtypeHostedEvidenceContractHistoricalAdditions
	, ownedSubtypeHostedEvidenceContractHistoryParent
	, ownedSubtypeHostedEvidenceContractHistoryPath
	, ownedSubtypeHostedEvidenceContractImplementation
	, ownedSubtypeHostedEvidenceContractImplementationPaths
	, ownedSubtypeHostedEvidenceContractIntegrationPaths
	, ownedSubtypeHostedEvidenceContractModifiedPaths
	, ownedSubtypeHostedEvidenceContractPredecessor
	, reverseOwnedSubtypeHostedEvidenceContractUpdate
} from "./owned-subtype-hosted-evidence-contract-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype hosted evidence history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeHostedEvidenceContractHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-subtype-hosted-evidence-contract-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypeHostedEvidenceContractPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeHostedEvidenceContractImplementation);
	assert.deepEqual(record.implementationCommits
		, ownedSubtypeHostedEvidenceContractCommits);
	assert.equal(record.historyParentCommit
		, ownedSubtypeHostedEvidenceContractHistoryParent);
	assert.deepEqual(record.historicalUpdates.map(item => item.path)
		, ownedSubtypeHostedEvidenceContractModifiedPaths);
	assert.deepEqual(record.historicalAdditions.map(item => item.path)
		, ownedSubtypeHostedEvidenceContractHistoricalAdditions);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeHostedEvidenceContractIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeHostedEvidenceContractAddedPaths);
	for(const update of record.historicalUpdates)
	{
		const current = git(["show"
			, `${ownedSubtypeHostedEvidenceContractImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${ownedSubtypeHostedEvidenceContractPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeHostedEvidenceContractUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.historicalAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedSubtypeHostedEvidenceContractPredecessor
			, "--", addition.path]).trim(), "", addition.path);
		assert.equal(sha256(git(["show"
			, `${ownedSubtypeHostedEvidenceContractImplementation}:${addition.path}`]))
		, addition.currentSha256, addition.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypeHostedEvidenceContractSource);
		const previous = git(["show"
			, `${ownedSubtypeHostedEvidenceContractHistoryParent}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeHostedEvidenceContractUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned Subtype hosted evidence history range is exact", () => {
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${ownedSubtypeHostedEvidenceContractPredecessor}..${ownedSubtypeHostedEvidenceContractImplementation}`])
		.trim().split("\n"), ownedSubtypeHostedEvidenceContractCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeHostedEvidenceContractPredecessor
		, ownedSubtypeHostedEvidenceContractImplementation]).trim().split("\n").sort()
	, [...ownedSubtypeHostedEvidenceContractImplementationPaths].sort());
});

test("owned Subtype hosted evidence history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeHostedEvidenceContractHistoryPath, "utf8"));
	const update = structuredClone(record.historicalUpdates[0]);
	const current = git(["show"
		, `${ownedSubtypeHostedEvidenceContractImplementation}:${update.path}`]);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseOwnedSubtypeHostedEvidenceContractUpdate(current, update));
});

test("owned Subtype hosted evidence writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-owned-subtype-hosted-evidence-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-hosted-evidence-contract-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
