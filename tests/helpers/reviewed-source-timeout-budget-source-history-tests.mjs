/**
 * Authenticate the fresh reviewed-source timeout-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertReviewedSourceTimeoutBudget
	, beforeReviewedSourceTimeoutBudgetSource
	, reviewedSourceTimeoutBudgetHistoryAdditions
	, reviewedSourceTimeoutBudgetHistoryPath
	, reviewedSourceTimeoutBudgetImplementation
	, reviewedSourceTimeoutBudgetImplementationPaths
	, reviewedSourceTimeoutBudgetIntegrationPaths
	, reviewedSourceTimeoutBudgetPredecessor
	, reverseReviewedSourceTimeoutBudgetUpdate
} from "./reviewed-source-timeout-budget-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	reviewedSourceTimeoutBudgetHistoryPath, "utf8"));

test("reviewed-source budget records the exact timeout boundary", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "reviewed-source-timeout-budget-v1");
	assert.equal(history.predecessorCommit
		, reviewedSourceTimeoutBudgetPredecessor);
	assert.equal(history.implementationCommit
		, reviewedSourceTimeoutBudgetImplementation);
	assert.deepEqual(history.discovery, {
		run: 41285158941, job: 124789859338
		, test: "fresh Lean checks review identities, record layouts, selection and drift before linking"
		, priorSuccessMilliseconds: 170649.192996
		, hostedTimeoutMilliseconds: 180003.32307
		, localTimeoutMilliseconds: 180041.433069
	});
});

test("reviewed-source budget preserves every semantic refusal", async () => {
	const history = await record();
	const source = git(["show"
		, `${reviewedSourceTimeoutBudgetImplementation}:${
			reviewedSourceTimeoutBudgetImplementationPaths[0]}`]);
	assertReviewedSourceTimeoutBudget(source);
	assert.deepEqual(history.repair, {
		previousTimeoutMilliseconds: 180000, timeoutMilliseconds: 300000
		, refusalVariants: 8, localPassMilliseconds: 188608.836624
	});
	assert.deepEqual(history.exactModel, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	});
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.runtimeSemanticChanges, 0);
});

test("reviewed-source budget reverses every authenticated source", async () => {
	const history = await record();
	assert.deepEqual(history.updates.map(update => update.path)
		, reviewedSourceTimeoutBudgetImplementationPaths);
	for(const update of history.updates)
	{
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			reviewedSourceTimeoutBudgetImplementation, update.path), update)
		, true, update.path);
		const current = git(["show"
			, `${reviewedSourceTimeoutBudgetImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${reviewedSourceTimeoutBudgetPredecessor}:${update.path}`]);
		assert.equal(beforeReviewedSourceTimeoutBudgetSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, reviewedSourceTimeoutBudgetIntegrationPaths);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${reviewedSourceTimeoutBudgetImplementation}:${update.path}`]);
		assert.equal(reverseReviewedSourceTimeoutBudgetUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...reviewedSourceTimeoutBudgetImplementationPaths
		, ...reviewedSourceTimeoutBudgetIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("reviewed-source budget binds additions and rejects forgeries", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, reviewedSourceTimeoutBudgetHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = git(["show"
		, `${reviewedSourceTimeoutBudgetImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseReviewedSourceTimeoutBudgetUpdate(current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-reviewed-source-timeout-budget-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /already exists|Expected values to be strictly equal/u);
});
