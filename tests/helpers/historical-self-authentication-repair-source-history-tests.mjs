/**
 * Qualify the historical self-authentication repair lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHistoricalSelfAuthenticationRepairSource
	, historicalSelfAuthenticationRepairHistoryAdditions
	, historicalSelfAuthenticationRepairHistoryPath
	, historicalSelfAuthenticationRepairImplementation
	, historicalSelfAuthenticationRepairImplementationPaths
	, historicalSelfAuthenticationRepairIntegrationPaths
	, historicalSelfAuthenticationRepairNormalizationPaths
	, historicalSelfAuthenticationRepairPredecessor
	, reverseHistoricalSelfAuthenticationRepairUpdate
} from "./historical-self-authentication-repair-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	historicalSelfAuthenticationRepairHistoryPath, "utf8"));

test("historical self-authentication repair records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "historical-self-authentication-repair-source-v1");
		assert.equal(value.predecessorCommit
			, historicalSelfAuthenticationRepairPredecessor);
		assert.equal(value.implementationCommit
			, historicalSelfAuthenticationRepairImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, [...historicalSelfAuthenticationRepairImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, [...historicalSelfAuthenticationRepairIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("historical self-authentication repair reverses every exact source"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${historicalSelfAuthenticationRepairImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${historicalSelfAuthenticationRepairPredecessor}:${update.path}`]);
			assert.equal(reverseHistoricalSelfAuthenticationRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeHistoricalSelfAuthenticationRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				historicalSelfAuthenticationRepairHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${historicalSelfAuthenticationRepairImplementation}:${update.path}`]);
			assert.equal(reverseHistoricalSelfAuthenticationRepairUpdate(
				current, update), previous, update.path);
		}
	}
);

test("historical self-authentication repair authenticates registration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...historicalSelfAuthenticationRepairHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${historicalSelfAuthenticationRepairImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryRecordSource(
				historicalSelfAuthenticationRepairHistoryPath, addition.path
				, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...historicalSelfAuthenticationRepairImplementationPaths
			, ...historicalSelfAuthenticationRepairIntegrationPaths
		]) assert.ok(historicalSelfAuthenticationRepairNormalizationPaths
			.includes(path), path);
	}
);

test("historical self-authentication repair rejects forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${historicalSelfAuthenticationRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseHistoricalSelfAuthenticationRepairUpdate(
			current, forged));
		const result = spawnSync(process.execPath, [
			"scripts/update-historical-self-authentication-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(result.status, 0);
	}
);
