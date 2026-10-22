/**
 * Authenticate the dependent checked-record promotion contract history.
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
	beforeDependentCheckedRecordPromotionContractSource
	, dependentCheckedRecordPromotionContractAddedPaths
	, dependentCheckedRecordPromotionContractHistoryPath
	, dependentCheckedRecordPromotionContractImplementation
	, dependentCheckedRecordPromotionContractImplementationAdditions
	, dependentCheckedRecordPromotionContractImplementationPaths
	, dependentCheckedRecordPromotionContractIntegrationPaths
	, dependentCheckedRecordPromotionContractModifiedPaths
	, dependentCheckedRecordPromotionContractPredecessor
	, reverseDependentCheckedRecordPromotionContractUpdate
} from "./dependent-checked-record-promotion-contract-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent checked-record promotion contract restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPromotionContractHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-promotion-contract-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPromotionContractPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPromotionContractImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordPromotionContractModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPromotionContractIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, dependentCheckedRecordPromotionContractAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeDependentCheckedRecordPromotionContractSource);
		const previous = git(["show"
			, `${dependentCheckedRecordPromotionContractPredecessor}:${update.path}`]);
		assert.equal(reverseDependentCheckedRecordPromotionContractUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeDependentCheckedRecordPromotionContractSource);
		const previous = git(["show"
			, `${dependentCheckedRecordPromotionContractImplementation}:${update.path}`]);
		assert.equal(reverseDependentCheckedRecordPromotionContractUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("dependent checked-record promotion contract range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${dependentCheckedRecordPromotionContractImplementation}^`]).trim()
	, dependentCheckedRecordPromotionContractPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, dependentCheckedRecordPromotionContractPredecessor
		, dependentCheckedRecordPromotionContractImplementation])
		.trim().split("\n").sort()
	, [...dependentCheckedRecordPromotionContractImplementationPaths].sort());
	for(const path of dependentCheckedRecordPromotionContractImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, dependentCheckedRecordPromotionContractPredecessor
			, "--", path]).trim(), "");
		assert.notEqual(git(["ls-tree", "--name-only"
			, dependentCheckedRecordPromotionContractImplementation
			, "--", path]).trim(), "");
	}
});

test("dependent checked-record promotion contract rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPromotionContractHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeDependentCheckedRecordPromotionContractSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPromotionContractUpdate(
		current, update));
});

test("dependent checked-record promotion history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-checked-record-promotion-history-"));
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
		"scripts/update-dependent-checked-record-promotion-contract-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
