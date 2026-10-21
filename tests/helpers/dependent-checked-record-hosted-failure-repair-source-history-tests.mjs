/**
 * Authenticate the hosted dependent checked-record failure repairs.
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
	beforeDependentCheckedRecordHostedFailureRepairSource
	, dependentCheckedRecordHostedFailureRepairBrowserImplementation
	, dependentCheckedRecordHostedFailureRepairBrowserPaths
	, dependentCheckedRecordHostedFailureRepairChangedPaths
	, dependentCheckedRecordHostedFailureRepairHistoryPath
	, dependentCheckedRecordHostedFailureRepairIntegrationPaths
	, dependentCheckedRecordHostedFailureRepairNativeImplementation
	, dependentCheckedRecordHostedFailureRepairNativePaths
	, dependentCheckedRecordHostedFailureRepairPredecessor
	, reverseDependentCheckedRecordHostedFailureRepairUpdate
} from "./dependent-checked-record-hosted-failure-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("hosted dependent-record repairs restore every changed source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordHostedFailureRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-hosted-failure-repair-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordHostedFailureRepairPredecessor);
	assert.equal(record.browserImplementationCommit
		, dependentCheckedRecordHostedFailureRepairBrowserImplementation);
	assert.equal(record.nativeImplementationCommit
		, dependentCheckedRecordHostedFailureRepairNativeImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordHostedFailureRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordHostedFailureRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordHostedFailureRepairSource);
		const previousRevision
			= dependentCheckedRecordHostedFailureRepairBrowserPaths
				.includes(update.path)
				? dependentCheckedRecordHostedFailureRepairPredecessor
				: dependentCheckedRecordHostedFailureRepairBrowserImplementation;
		const previous
			= reverseDependentCheckedRecordHostedFailureRepairUpdate(
				current, update);
		assert.equal(previous, sourceAt(previousRevision, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordHostedFailureRepairSource);
		assert.equal(reverseDependentCheckedRecordHostedFailureRepairUpdate(
			current, update), sourceAt(
			dependentCheckedRecordHostedFailureRepairNativeImplementation
			, update.path));
	}
	assert.deepEqual(new Set([
		...dependentCheckedRecordHostedFailureRepairBrowserPaths
		, ...dependentCheckedRecordHostedFailureRepairNativePaths
	]), new Set(dependentCheckedRecordHostedFailureRepairChangedPaths));
});

test("hosted dependent-record repair rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordHostedFailureRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordHostedFailureRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordHostedFailureRepairUpdate(
		current, update));
});

test("hosted dependent-record repair writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-hosted-failure-repair-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-hosted-failure-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /native implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
