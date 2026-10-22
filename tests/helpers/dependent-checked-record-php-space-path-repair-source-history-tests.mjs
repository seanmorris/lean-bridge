/**
 * Authenticate the dependent checked-record native PHP space-path repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeDependentCheckedRecordPhpSpacePathRepairSource
	, dependentCheckedRecordPhpSpacePathRepairChangedPaths
	, dependentCheckedRecordPhpSpacePathRepairHistoryPath
	, dependentCheckedRecordPhpSpacePathRepairImplementation
	, dependentCheckedRecordPhpSpacePathRepairIntegrationBase
	, dependentCheckedRecordPhpSpacePathRepairIntegrationPaths
	, dependentCheckedRecordPhpSpacePathRepairPredecessor
	, reverseDependentCheckedRecordPhpSpacePathRepairUpdate
} from "./dependent-checked-record-php-space-path-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent checked-record PHP space-path repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpSpacePathRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-php-space-path-repair-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPhpSpacePathRepairPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPhpSpacePathRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, dependentCheckedRecordPhpSpacePathRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordPhpSpacePathRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPhpSpacePathRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpSpacePathRepairSource);
		assert.equal(reverseDependentCheckedRecordPhpSpacePathRepairUpdate(
			current, update), sourceAt(
			dependentCheckedRecordPhpSpacePathRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			dependentCheckedRecordPhpSpacePathRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpSpacePathRepairSource);
		assert.equal(reverseDependentCheckedRecordPhpSpacePathRepairUpdate(
			current, update), sourceAt(
			dependentCheckedRecordPhpSpacePathRepairIntegrationBase, update.path));
	}
});

test("dependent checked-record PHP space-path repair history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpSpacePathRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPhpSpacePathRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPhpSpacePathRepairUpdate(
		current, update));
});

test("dependent checked-record PHP space-path repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-record-php-space-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-php-space-path-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration base commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
