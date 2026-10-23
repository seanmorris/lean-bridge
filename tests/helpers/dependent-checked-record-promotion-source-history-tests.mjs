/**
 * Authenticate the complete dependent checked-record support promotion.
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
	beforeDependentCheckedRecordPromotionSource
	, dependentCheckedRecordPromotionAddedPaths
	, dependentCheckedRecordPromotionFoundationAddedPaths
	, dependentCheckedRecordPromotionHistoryPath
	, dependentCheckedRecordPromotionImplementation
	, dependentCheckedRecordPromotionIntegrationPaths
	, dependentCheckedRecordPromotionModifiedPaths
	, dependentCheckedRecordPromotionSourcePredecessor
	, reverseDependentCheckedRecordPromotionUpdate
} from "./dependent-checked-record-promotion-source-history.mjs";
import {
	finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);

test("dependent checked-record promotion restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPromotionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPromotionSourcePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPromotionImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordPromotionModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPromotionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, dependentCheckedRecordPromotionAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPromotionSource);
		const previous = source(
			dependentCheckedRecordPromotionSourcePredecessor, update.path);
		assert.equal(reverseDependentCheckedRecordPromotionUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPromotionSource);
		assert.equal(reverseDependentCheckedRecordPromotionUpdate(
			current, update), source(
			dependentCheckedRecordPromotionImplementation, update.path));
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("dependent checked-record promotion closes its exact tree", () => {
	assert.equal(git(["rev-parse"
		, `${dependentCheckedRecordPromotionImplementation}^`]).trim()
	, dependentCheckedRecordPromotionSourcePredecessor);
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, dependentCheckedRecordPromotionSourcePredecessor
		, dependentCheckedRecordPromotionImplementation])
	, [...dependentCheckedRecordPromotionModifiedPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
		, dependentCheckedRecordPromotionSourcePredecessor
		, dependentCheckedRecordPromotionImplementation])
	, [...dependentCheckedRecordPromotionFoundationAddedPaths].sort());
});

test("dependent checked-record promotion rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPromotionHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPromotionSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPromotionUpdate(
		current, update));
});

test("dependent checked-record promotion writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-checked-record-promotion-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-promotion-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
