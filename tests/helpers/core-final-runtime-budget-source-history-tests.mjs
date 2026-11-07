/**
 * Authenticate the measured final complete-Core shard budget.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCoreFinalRuntimeBudget
	, beforeCoreFinalRuntimeBudgetSource
	, coreFinalRuntimeBudgetBehavior
	, coreFinalRuntimeBudgetHistoryAdditions
	, coreFinalRuntimeBudgetHistoryPath
	, coreFinalRuntimeBudgetImplementation
	, coreFinalRuntimeBudgetImplementationPaths
	, coreFinalRuntimeBudgetIntegrationPaths
	, coreFinalRuntimeBudgetNormalizationPaths
	, coreFinalRuntimeBudgetPredecessor
	, reverseCoreFinalRuntimeBudgetUpdate
} from "./core-final-runtime-budget-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	coreFinalRuntimeBudgetHistoryPath, "utf8"));

test("final Core runtime budget records the exact hosted cancellation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-final-runtime-budget-v1");
	assert.equal(value.predecessorCommit, coreFinalRuntimeBudgetPredecessor);
	assert.equal(value.implementationCommit, coreFinalRuntimeBudgetImplementation);
	assert.equal(git(["rev-parse", `${coreFinalRuntimeBudgetImplementation}^`]).trim()
		, coreFinalRuntimeBudgetPredecessor);
	assert.deepEqual(value.discovery, {
		run: 42344725453, job: 128325268374
		, candidate: coreFinalRuntimeBudgetPredecessor
		, jobStartedAt: "2026-11-07T06:31:39Z"
		, contractStartedAt: "2026-11-07T06:38:54Z"
		, contractCancelledAt: "2026-11-07T10:31:52Z"
		, jobCancelledAt: "2026-11-07T10:31:55Z"
		, terminalTestCount: 414
	});
	assert.deepEqual(value.behavior, {
		...coreFinalRuntimeBudgetBehavior
		, livePinRefreshes: {
			...coreFinalRuntimeBudgetBehavior.livePinRefreshes
		}
	});
	assert.deepEqual(value.updates.map(update => update.path)
		, coreFinalRuntimeBudgetImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreFinalRuntimeBudgetIntegrationPaths);
});

test("final Core runtime budget binds the live matrix without weakening it", async () => {
	const sources = Object.fromEntries(coreFinalRuntimeBudgetImplementationPaths
		.map(path => [path, blob(coreFinalRuntimeBudgetImplementation, path)]));
	assert.deepEqual(assertCoreFinalRuntimeBudget(sources), {
		...coreFinalRuntimeBudgetBehavior
		, livePinRefreshes: {
			...coreFinalRuntimeBudgetBehavior.livePinRefreshes
		}
	});
	const previous = Object.fromEntries(coreFinalRuntimeBudgetImplementationPaths
		.map(path => [path, blob(coreFinalRuntimeBudgetPredecessor, path)]));
	assert.throws(() => assertCoreFinalRuntimeBudget(previous)
		, { name: "AssertionError" });
});

test("final Core runtime budget reverses implementation and integration", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = blob(coreFinalRuntimeBudgetImplementation, update.path);
		const previous = blob(coreFinalRuntimeBudgetPredecessor, update.path);
		assert.equal(beforeCoreFinalRuntimeBudgetSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(coreFinalRuntimeBudgetImplementation, update.path);
		assert.equal(reverseCoreFinalRuntimeBudgetUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of coreFinalRuntimeBudgetNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("final Core runtime budget refreshes only its one live workflow pin", async () => {
	const value = await record();
	assert.equal(value.refreshed.path, ".github/workflows/quality.yml");
	assert.equal(value.refreshed.count, 1);
	assert.equal(value.refreshed.previous
		, "d0e743d6d10bb47f5ba24d821f4f9e07302daa5e9b73e1fd3a5b84e84adda16b");
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
});

test("final Core runtime budget authenticates additions and rejects forgeries", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, coreFinalRuntimeBudgetHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = value.updates[0];
	const current = blob(coreFinalRuntimeBudgetImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCoreFinalRuntimeBudgetUpdate(current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-final-runtime-budget-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /History already exists|Expected values to be strictly equal/u);
});
