/**
 * Authenticate the focused documentation, ABI-control and WIT repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCoreFocusedRootRepair
	, beforeCoreFocusedRootRepairSource
	, coreFocusedRootRepairHistoryAdditions
	, coreFocusedRootRepairHistoryPath
	, coreFocusedRootRepairImplementation
	, coreFocusedRootRepairImplementationPaths
	, coreFocusedRootRepairIntegrationPaths
	, coreFocusedRootRepairNormalizationPaths
	, coreFocusedRootRepairPredecessor
	, reverseCoreFocusedRootRepairUpdate
} from "./core-focused-root-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreFocusedRootRepairHistoryPath, "utf8"));

test("focused root repair records its exact three-commit implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone, "core-focused-root-repair-source-v1");
		assert.equal(value.predecessorCommit, coreFocusedRootRepairPredecessor);
		assert.equal(value.implementationCommit, coreFocusedRootRepairImplementation);
		assert.deepEqual(value.behavior, {
			generatedGuides: 6, compilerPagesChecked: 8, repairedControls: 3
		});
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("focused root repair binds all eleven implementation paths", async () => {
	const sources = Object.fromEntries(coreFocusedRootRepairImplementationPaths
		.map(path => [
			path
			, git(["show", `${coreFocusedRootRepairImplementation}:${path}`])
		])
	);
	assert.deepEqual(assertCoreFocusedRootRepair(sources), {
		generatedGuides: 6, compilerPagesChecked: 8, repairedControls: 3
		, changedSupportCells: 0, runtimeSemanticChanges: 0
	});
	const changed = structuredClone(sources);
	changed["docs/consume/java.md"] = changed["docs/consume/java.md"]
		.replace("| `boxed @Nullable T; Option<T> remains explicit None/Some`."
			, "| boxed @Nullable T; Option<T> remains explicit None/Some.");
	assert.throws(() => assertCoreFocusedRootRepair(changed));
});

test("focused root repair reverses implementation and registration", async () => {
	const value = await record();
	assert.deepEqual(value.updates.map(update => update.path)
		, coreFocusedRootRepairImplementationPaths);
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${coreFocusedRootRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${coreFocusedRootRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCoreFocusedRootRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCoreFocusedRootRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreFocusedRootRepairIntegrationPaths);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			coreFocusedRootRepairHistoryPath, update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreFocusedRootRepairImplementation}:${update.path}`]);
		assert.equal(reverseCoreFocusedRootRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("focused root repair authenticates unchanged model and history controls"
	, async () => {
		const value = await record();
		assert.equal(value.exactModel.cells, 1054);
		assert.equal(value.exactModel.stageEntries, 5270);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, coreFocusedRootRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${coreFocusedRootRepairImplementation}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...coreFocusedRootRepairImplementationPaths
			, ...coreFocusedRootRepairIntegrationPaths
		]) {
			assert.ok(coreFocusedRootRepairNormalizationPaths.includes(path), path);
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		}
	}
);
