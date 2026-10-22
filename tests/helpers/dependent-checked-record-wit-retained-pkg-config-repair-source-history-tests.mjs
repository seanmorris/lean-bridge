/**
 * Authenticate the retained WIT pkg-config parser repair.
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
	beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource
	, dependentCheckedRecordWitRetainedPkgConfigRepairChangedPaths
	, dependentCheckedRecordWitRetainedPkgConfigRepairHistoryPath
	, dependentCheckedRecordWitRetainedPkgConfigRepairImplementation
	, dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationBase
	, dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationPaths
	, dependentCheckedRecordWitRetainedPkgConfigRepairPredecessor
	, reverseDependentCheckedRecordWitRetainedPkgConfigRepairIntegration
	, reverseDependentCheckedRecordWitRetainedPkgConfigRepairUpdate
} from "./dependent-checked-record-wit-retained-pkg-config-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("retained WIT pkg-config repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitRetainedPkgConfigRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-wit-retained-pkg-config-repair-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordWitRetainedPkgConfigRepairPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordWitRetainedPkgConfigRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordWitRetainedPkgConfigRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource);
		assert.equal(reverseDependentCheckedRecordWitRetainedPkgConfigRepairUpdate(
			current, update), sourceAt(
				dependentCheckedRecordWitRetainedPkgConfigRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
				dependentCheckedRecordWitRetainedPkgConfigRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource);
		assert.equal(
			reverseDependentCheckedRecordWitRetainedPkgConfigRepairIntegration(
				current, update)
			, sourceAt(dependentCheckedRecordWitRetainedPkgConfigRepairIntegrationBase
				, update.path));
	}
});

test("retained WIT pkg-config repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitRetainedPkgConfigRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordWitRetainedPkgConfigRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordWitRetainedPkgConfigRepairUpdate(
		current, update));
});

test("retained WIT pkg-config writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-wit-retained-pkg-config-repair-"));
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
		"scripts/update-dependent-checked-record-wit-retained-pkg-config-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration base commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
