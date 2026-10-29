/**
 * Qualify the historical contract replay repair lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHistoricalContractReplayRepairSource
	, historicalContractReplayRepairHistoryAdditions
	, historicalContractReplayRepairHistoryPath
	, historicalContractReplayRepairImplementation
	, historicalContractReplayRepairImplementationPaths
	, historicalContractReplayRepairIntegrationPaths
	, historicalContractReplayRepairNormalizationPaths
	, historicalContractReplayRepairPredecessor
	, reverseHistoricalContractReplayRepairUpdate
} from "./historical-contract-replay-repair-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	historicalContractReplayRepairHistoryPath, "utf8"));

test("historical replay repair records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "historical-contract-replay-repair-source-v1");
	assert.equal(value.predecessorCommit
		, historicalContractReplayRepairPredecessor);
	assert.equal(value.implementationCommit
		, historicalContractReplayRepairImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, [...historicalContractReplayRepairImplementationPaths]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, [...historicalContractReplayRepairIntegrationPaths]);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
});

test("historical replay repair reverses every exact source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${historicalContractReplayRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${historicalContractReplayRepairPredecessor}:${update.path}`]);
		assert.equal(reverseHistoricalContractReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHistoricalContractReplayRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			historicalContractReplayRepairHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${historicalContractReplayRepairImplementation}:${update.path}`]);
		assert.equal(reverseHistoricalContractReplayRepairUpdate(
			current, update), previous, update.path);
	}
});

test("historical replay repair authenticates isolated registration", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...historicalContractReplayRepairHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${historicalContractReplayRepairImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await sourceAtFinHistoryRecordSource(
			historicalContractReplayRepairHistoryPath, addition.path
			, addition.sha256)), addition.sha256, addition.path);
	}
	for(const path of [
		...historicalContractReplayRepairImplementationPaths
		, ...historicalContractReplayRepairIntegrationPaths
	]) assert.ok(historicalContractReplayRepairNormalizationPaths.includes(path)
		, path);
	assert.ok(historicalContractReplayRepairImplementationPaths.every(path =>
		path.startsWith("tests/helpers/")), "repair changes only test helpers");
});

test("historical replay repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${historicalContractReplayRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHistoricalContractReplayRepairUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-historical-contract-replay-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
