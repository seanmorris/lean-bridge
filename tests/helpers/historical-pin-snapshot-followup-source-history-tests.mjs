/**
 * Authenticate the remaining historical pin-snapshot isolation repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeHistoricalPinSnapshotFollowupSource
	, historicalPinSnapshotFollowupHistoryAdditions
	, historicalPinSnapshotFollowupHistoryPath
	, historicalPinSnapshotFollowupImplementation
	, historicalPinSnapshotFollowupImplementationPaths
	, historicalPinSnapshotFollowupIntegrationPaths
	, historicalPinSnapshotFollowupPredecessor
	, reverseHistoricalPinSnapshotFollowupUpdate
} from "./historical-pin-snapshot-followup-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	historicalPinSnapshotFollowupHistoryPath, "utf8"));

test("historical pin follow-up records both exact source repairs", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "historical-pin-snapshot-followup-v1");
	assert.equal(value.predecessorCommit
		, historicalPinSnapshotFollowupPredecessor);
	assert.equal(value.implementationCommit
		, historicalPinSnapshotFollowupImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, historicalPinSnapshotFollowupImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, historicalPinSnapshotFollowupIntegrationPaths);
});

test("historical pin follow-up removes every fixed live-inventory assertion"
	, () => {
		const matrix = git(["show"
			, `${historicalPinSnapshotFollowupImplementation}:`
				+ historicalPinSnapshotFollowupImplementationPaths[0]]);
		assert.doesNotMatch(matrix
			, /readFile\(\s*"docs\/type-surface\.v1\.json"/u);
		assert.match(matrix, /applyRecordedUpdate\(/u);
		assert.match(matrix, /sourceAtFinHistoryMilestone\(/u);
		const python = git(["show"
			, `${historicalPinSnapshotFollowupImplementation}:`
				+ historicalPinSnapshotFollowupImplementationPaths[1]]);
		assert.doesNotMatch(python
			, /readFile\(\s*"docs\/type-surface\.v1\.json"/u);
		assert.ok(python.includes(
			"pythonDependentFinNatRejectionImplementation"
			+ '\n\t\t\t+ ":docs/type-surface.v1.json"'));
	}
);

test("historical pin follow-up reverses source and integration transitions"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${historicalPinSnapshotFollowupImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${historicalPinSnapshotFollowupPredecessor}:${update.path}`]);
			assert.equal(reverseHistoricalPinSnapshotFollowupUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeHistoricalPinSnapshotFollowupSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				historicalPinSnapshotFollowupHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${historicalPinSnapshotFollowupImplementation}:${update.path}`]);
			assert.equal(reverseHistoricalPinSnapshotFollowupUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("historical pin follow-up authenticates additions and unchanged model"
	, async () => {
		const value = await record();
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(value.changedSupportCells, 0);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, historicalPinSnapshotFollowupHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${historicalPinSnapshotFollowupImplementation}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of historicalPinSnapshotFollowupIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const exactSources = [historicalPinSnapshotFollowupPredecessor
			, historicalPinSnapshotFollowupImplementation].map(commit =>
			git(["show", `${commit}:${exactModelPath}`]));
		assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
	}
);
