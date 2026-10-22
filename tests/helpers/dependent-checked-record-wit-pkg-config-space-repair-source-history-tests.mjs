/**
 * Authenticate the dependent checked-record WIT pkg-config space-path repair.
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
	beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource
	, dependentCheckedRecordWitPkgConfigSpaceRepairChangedPaths
	, dependentCheckedRecordWitPkgConfigSpaceRepairHistoryPath
	, dependentCheckedRecordWitPkgConfigSpaceRepairImplementation
	, dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationBase
	, dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationPaths
	, dependentCheckedRecordWitPkgConfigSpaceRepairPredecessor
	, reverseDependentCheckedRecordWitPkgConfigSpaceRepairIntegration
	, reverseDependentCheckedRecordWitPkgConfigSpaceRepairUpdate
} from "./dependent-checked-record-wit-pkg-config-space-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent WIT pkg-config space repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitPkgConfigSpaceRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-wit-pkg-config-space-repair-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordWitPkgConfigSpaceRepairPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordWitPkgConfigSpaceRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordWitPkgConfigSpaceRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource);
		assert.equal(reverseDependentCheckedRecordWitPkgConfigSpaceRepairUpdate(
			current, update), sourceAt(
			dependentCheckedRecordWitPkgConfigSpaceRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			dependentCheckedRecordWitPkgConfigSpaceRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource);
		assert.equal(
			reverseDependentCheckedRecordWitPkgConfigSpaceRepairIntegration(
				current, update)
			, sourceAt(dependentCheckedRecordWitPkgConfigSpaceRepairIntegrationBase
				, update.path));
	}
});

test("dependent WIT pkg-config space repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitPkgConfigSpaceRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordWitPkgConfigSpaceRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordWitPkgConfigSpaceRepairUpdate(
		current, update));
});

test("dependent WIT pkg-config space writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-wit-pkg-config-space-repair-"));
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
		"scripts/update-dependent-checked-record-wit-pkg-config-space-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration base commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
