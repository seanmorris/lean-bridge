/**
 * Authenticate the dependent checked-record browser reviewed-route repair.
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
	beforeDependentCheckedRecordBrowserReviewedRouteRepairSource
	, dependentCheckedRecordBrowserReviewedRouteRepairAddedPaths
	, dependentCheckedRecordBrowserReviewedRouteRepairChangedPaths
	, dependentCheckedRecordBrowserReviewedRouteRepairHistoryPath
	, dependentCheckedRecordBrowserReviewedRouteRepairImplementation
	, dependentCheckedRecordBrowserReviewedRouteRepairIntegrationPaths
	, dependentCheckedRecordBrowserReviewedRouteRepairPredecessor
	, reverseDependentCheckedRecordBrowserReviewedRouteRepairUpdate
} from "./dependent-checked-record-browser-reviewed-route-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent browser reviewed-route repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordBrowserReviewedRouteRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-browser-reviewed-route-repair-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordBrowserReviewedRouteRepairPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordBrowserReviewedRouteRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordBrowserReviewedRouteRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordBrowserReviewedRouteRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, dependentCheckedRecordBrowserReviewedRouteRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeDependentCheckedRecordBrowserReviewedRouteRepairSource);
		const previous = git(["show"
			, `${dependentCheckedRecordBrowserReviewedRouteRepairPredecessor}:${update.path}`]);
		assert.equal(reverseDependentCheckedRecordBrowserReviewedRouteRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeDependentCheckedRecordBrowserReviewedRouteRepairSource);
		const previous = git(["show"
			, `${dependentCheckedRecordBrowserReviewedRouteRepairImplementation}:${update.path}`]);
		assert.equal(reverseDependentCheckedRecordBrowserReviewedRouteRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("dependent browser reviewed-route repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${dependentCheckedRecordBrowserReviewedRouteRepairImplementation}^`]).trim()
	, dependentCheckedRecordBrowserReviewedRouteRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, dependentCheckedRecordBrowserReviewedRouteRepairPredecessor
		, dependentCheckedRecordBrowserReviewedRouteRepairImplementation])
		.trim().split("\n").sort()
	, [...dependentCheckedRecordBrowserReviewedRouteRepairChangedPaths].sort());
});

test("dependent browser reviewed-route repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordBrowserReviewedRouteRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeDependentCheckedRecordBrowserReviewedRouteRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordBrowserReviewedRouteRepairUpdate(
		current, update));
});

test("dependent browser reviewed-route repair writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-browser-reviewed-route-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-browser-reviewed-route-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
