/**
 * Authenticate the dependent checked-record browser diagnostic repair.
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
	beforeDependentCheckedRecordBrowserDiagnosticRepairSource
	, dependentCheckedRecordBrowserDiagnosticRepairChangedPaths
	, dependentCheckedRecordBrowserDiagnosticRepairHistoryPath
	, dependentCheckedRecordBrowserDiagnosticRepairImplementation
	, dependentCheckedRecordBrowserDiagnosticRepairIntegrationBase
	, dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths
	, dependentCheckedRecordBrowserDiagnosticRepairPredecessor
	, reverseDependentCheckedRecordBrowserDiagnosticRepairIntegration
	, reverseDependentCheckedRecordBrowserDiagnosticRepairUpdate
} from "./dependent-checked-record-browser-diagnostic-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent browser diagnostic repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordBrowserDiagnosticRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-browser-diagnostic-repair-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordBrowserDiagnosticRepairPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordBrowserDiagnosticRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, dependentCheckedRecordBrowserDiagnosticRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordBrowserDiagnosticRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordBrowserDiagnosticRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordBrowserDiagnosticRepairSource);
		assert.equal(reverseDependentCheckedRecordBrowserDiagnosticRepairUpdate(
			current, update), sourceAt(
			dependentCheckedRecordBrowserDiagnosticRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			dependentCheckedRecordBrowserDiagnosticRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordBrowserDiagnosticRepairSource);
		assert.equal(reverseDependentCheckedRecordBrowserDiagnosticRepairIntegration(
			current, update), sourceAt(
			dependentCheckedRecordBrowserDiagnosticRepairIntegrationBase, update.path));
	}
});

test("dependent browser diagnostic repair history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordBrowserDiagnosticRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordBrowserDiagnosticRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordBrowserDiagnosticRepairUpdate(
		current, update));
});

test("dependent browser diagnostic repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-browser-diagnostic-repair-"));
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
		"scripts/update-dependent-checked-record-browser-diagnostic-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration base commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
