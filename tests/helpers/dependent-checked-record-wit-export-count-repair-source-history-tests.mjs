/**
 * Authenticate the dependent checked-record WIT export-count repair.
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
	beforeDependentCheckedRecordWitExportCountRepairSource
	, dependentCheckedRecordWitExportCountRepairChangedPaths
	, dependentCheckedRecordWitExportCountRepairHistoryPath
	, dependentCheckedRecordWitExportCountRepairImplementation
	, dependentCheckedRecordWitExportCountRepairIntegrationBase
	, dependentCheckedRecordWitExportCountRepairIntegrationPaths
	, dependentCheckedRecordWitExportCountRepairPredecessor
	, reverseDependentCheckedRecordWitExportCountRepairIntegration
	, reverseDependentCheckedRecordWitExportCountRepairUpdate
} from "./dependent-checked-record-wit-export-count-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent WIT export-count repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitExportCountRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-wit-export-count-repair-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordWitExportCountRepairPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordWitExportCountRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, dependentCheckedRecordWitExportCountRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordWitExportCountRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordWitExportCountRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitExportCountRepairSource);
		assert.equal(reverseDependentCheckedRecordWitExportCountRepairUpdate(
			current, update), sourceAt(
			dependentCheckedRecordWitExportCountRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			dependentCheckedRecordWitExportCountRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitExportCountRepairSource);
		assert.equal(reverseDependentCheckedRecordWitExportCountRepairIntegration(
			current, update), sourceAt(
			dependentCheckedRecordWitExportCountRepairIntegrationBase, update.path));
	}
});

test("dependent WIT export-count repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitExportCountRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordWitExportCountRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordWitExportCountRepairUpdate(
		current, update));
});

test("dependent WIT export-count writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-wit-export-count-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-wit-export-count-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration base commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
