/**
 * Authenticate the folded source-history state reconstruction repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertFoldedHistoryStateReconstructionRepair
	, beforeFoldedHistoryStateReconstructionRepairSource
	, foldedHistoryStateReconstructionRepairBehavior
	, foldedHistoryStateReconstructionRepairHistoryAdditions
	, foldedHistoryStateReconstructionRepairHistoryPath
	, foldedHistoryStateReconstructionRepairImplementation
	, foldedHistoryStateReconstructionRepairImplementationPaths
	, foldedHistoryStateReconstructionRepairIntegrationPaths
	, foldedHistoryStateReconstructionRepairNormalizationPaths
	, foldedHistoryStateReconstructionRepairPredecessor
	, reverseFoldedHistoryStateReconstructionRepairUpdate
} from "./folded-history-state-reconstruction-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	foldedHistoryStateReconstructionRepairHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	foldedHistoryStateReconstructionRepairImplementationPaths.map(path => [
		path, blob(foldedHistoryStateReconstructionRepairImplementation, path)
	])
);

test("folded history reconstruction records the complete post-commit failure"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "folded-history-state-reconstruction-repair-v1");
		assert.equal(value.predecessorCommit
			, foldedHistoryStateReconstructionRepairPredecessor);
		assert.equal(value.implementationCommit
			, foldedHistoryStateReconstructionRepairImplementation);
		assert.equal(git(["rev-parse"
			, `${foldedHistoryStateReconstructionRepairImplementation}^`]).trim()
			, foldedHistoryStateReconstructionRepairPredecessor);
		assert.deepEqual(value.discovery, {
			candidate: foldedHistoryStateReconstructionRepairPredecessor
			, coreRun: 42282673085
			, profile: "checked-javascript-partition-11"
			, failingTests: 4, passingTests: 10
			, missingIntermediateCommits: 3
		});
		assert.deepEqual(value.updates.map(update => update.path)
			, foldedHistoryStateReconstructionRepairImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, foldedHistoryStateReconstructionRepairIntegrationPaths);
	}
);

test("folded history reconstruction uses the hub for every synthetic state"
	, () => {
		const sources = implementationSources();
		assert.deepEqual(assertFoldedHistoryStateReconstructionRepair(sources)
			, foldedHistoryStateReconstructionRepairBehavior);
		for(const path of foldedHistoryStateReconstructionRepairImplementationPaths)
		{
			const changed = { ...sources, [path]: sources[path].replace(
				"sourceAtFinHistoryMilestone", "sourceAtFinHistoryRecordSource") };
			assert.notEqual(changed[path], sources[path], path);
			assert.throws(() =>
				assertFoldedHistoryStateReconstructionRepair(changed)
			, { name: "AssertionError" }, path);
		}
	}
);

test("folded history reconstruction reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(
				foldedHistoryStateReconstructionRepairImplementation, update.path);
			const previous = blob(
				foldedHistoryStateReconstructionRepairPredecessor, update.path);
			assert.equal(reverseFoldedHistoryStateReconstructionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFoldedHistoryStateReconstructionRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(
				foldedHistoryStateReconstructionRepairImplementation, update.path);
			assert.equal(reverseFoldedHistoryStateReconstructionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of foldedHistoryStateReconstructionRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("folded history reconstruction leaves pins and exact model unchanged"
	, async () => {
		const value = await record();
		const inventories = [foldedHistoryStateReconstructionRepairPredecessor
			, foldedHistoryStateReconstructionRepairImplementation].map(commit =>
			blob(commit, inventoryPath));
		assert.equal(sha256(inventories[0]), sha256(inventories[1]));
		assert.deepEqual(value.inventorySha256, {
			before: sha256(inventories[0]), after: sha256(inventories[1])
		});
		assert.deepEqual(value.refreshed, {});
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("folded history reconstruction authenticates additions and forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, foldedHistoryStateReconstructionRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates[0];
		const current = blob(
			foldedHistoryStateReconstructionRepairImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseFoldedHistoryStateReconstructionRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-folded-history-state-reconstruction-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
