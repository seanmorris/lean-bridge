/**
 * Qualify the optional-parameter route acceptance repair lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterRouteAcceptanceRepairSource
	, optionalParameterRouteAcceptanceRepairHistoryAdditions
	, optionalParameterRouteAcceptanceRepairHistoryPath
	, optionalParameterRouteAcceptanceRepairImplementation
	, optionalParameterRouteAcceptanceRepairImplementationPaths
	, optionalParameterRouteAcceptanceRepairIntegrationPaths
	, optionalParameterRouteAcceptanceRepairNormalizationPaths
	, optionalParameterRouteAcceptanceRepairPredecessor
	, reverseOptionalParameterRouteAcceptanceRepairUpdate
} from "./optional-parameter-route-acceptance-repair-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterRouteAcceptanceRepairHistoryPath, "utf8"));

test("optional route acceptance repair records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-route-acceptance-repair-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterRouteAcceptanceRepairPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterRouteAcceptanceRepairImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, [...optionalParameterRouteAcceptanceRepairImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, [...optionalParameterRouteAcceptanceRepairIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("optional route acceptance repair reverses every exact source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterRouteAcceptanceRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterRouteAcceptanceRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOptionalParameterRouteAcceptanceRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterRouteAcceptanceRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			optionalParameterRouteAcceptanceRepairHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${optionalParameterRouteAcceptanceRepairImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterRouteAcceptanceRepairUpdate(
			current, update), previous, update.path);
	}
});

test("optional route acceptance repair authenticates isolated registration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterRouteAcceptanceRepairHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterRouteAcceptanceRepairImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryRecordSource(
				optionalParameterRouteAcceptanceRepairHistoryPath, addition.path
				, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterRouteAcceptanceRepairImplementationPaths
			, ...optionalParameterRouteAcceptanceRepairIntegrationPaths
		]) assert.ok(optionalParameterRouteAcceptanceRepairNormalizationPaths
			.includes(path), path);
	}
);

test("optional route acceptance repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterRouteAcceptanceRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalParameterRouteAcceptanceRepairUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-route-acceptance-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
