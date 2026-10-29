/**
 * Qualify the optional-parameter WIT report contract repair lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterWitReportContractSource
	, optionalParameterWitReportContractHistoryAdditions
	, optionalParameterWitReportContractHistoryPath
	, optionalParameterWitReportContractImplementation
	, optionalParameterWitReportContractImplementationPaths
	, optionalParameterWitReportContractIntegrationPaths
	, optionalParameterWitReportContractNormalizationPaths
	, optionalParameterWitReportContractPredecessor
	, reverseOptionalParameterWitReportContractUpdate
} from "./optional-parameter-wit-report-contract-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterWitReportContractHistoryPath, "utf8"));

test("optional WIT report repair records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-parameter-wit-report-contract-source-v1");
	assert.equal(value.predecessorCommit
		, optionalParameterWitReportContractPredecessor);
	assert.equal(value.implementationCommit
		, optionalParameterWitReportContractImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, [...optionalParameterWitReportContractImplementationPaths]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, [...optionalParameterWitReportContractIntegrationPaths]);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
});

test("optional WIT report repair reverses every exact source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterWitReportContractImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterWitReportContractPredecessor}:${update.path}`]);
		assert.equal(reverseOptionalParameterWitReportContractUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterWitReportContractSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			optionalParameterWitReportContractHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${optionalParameterWitReportContractImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterWitReportContractUpdate(
			current, update), previous, update.path);
	}
});

test("optional WIT report repair authenticates isolated registration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterWitReportContractHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterWitReportContractImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryRecordSource(
				optionalParameterWitReportContractHistoryPath, addition.path
				, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterWitReportContractImplementationPaths
			, ...optionalParameterWitReportContractIntegrationPaths
		]) assert.ok(optionalParameterWitReportContractNormalizationPaths
			.includes(path), path);
	}
);

test("optional WIT report repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterWitReportContractImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalParameterWitReportContractUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-wit-report-contract-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
