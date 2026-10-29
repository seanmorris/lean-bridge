/**
 * Qualify current optional-repair history registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalRepairHistoryRegistrationSource
	, optionalRepairHistoryRegistrationHistoryAdditions
	, optionalRepairHistoryRegistrationHistoryPath
	, optionalRepairHistoryRegistrationImplementation
	, optionalRepairHistoryRegistrationImplementationPaths
	, optionalRepairHistoryRegistrationIntegrationPaths
	, optionalRepairHistoryRegistrationNormalizationPaths
	, optionalRepairHistoryRegistrationPredecessor
	, reverseOptionalRepairHistoryRegistrationUpdate
} from "./optional-repair-history-registration-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalRepairHistoryRegistrationHistoryPath, "utf8"));

test("optional repair history registration records its exact move", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-repair-history-registration-source-v1");
	assert.equal(value.predecessorCommit
		, optionalRepairHistoryRegistrationPredecessor);
	assert.equal(value.implementationCommit
		, optionalRepairHistoryRegistrationImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, [...optionalRepairHistoryRegistrationImplementationPaths]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, [...optionalRepairHistoryRegistrationIntegrationPaths]);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
});

test("optional repair history registration reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalRepairHistoryRegistrationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalRepairHistoryRegistrationPredecessor}:${update.path}`]);
		assert.equal(reverseOptionalRepairHistoryRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalRepairHistoryRegistrationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			optionalRepairHistoryRegistrationHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${optionalRepairHistoryRegistrationImplementation}:${update.path}`]);
		assert.equal(reverseOptionalRepairHistoryRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalRepairHistoryRegistrationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("optional repair history registration keeps suites reachable", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...optionalRepairHistoryRegistrationHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalRepairHistoryRegistrationImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0);
		assert.equal(sha256(await sourceAtFinHistoryRecordSource(
			optionalRepairHistoryRegistrationHistoryPath, addition.path
			, addition.sha256)), addition.sha256, addition.path);
	}
	for(const path of [
		...optionalRepairHistoryRegistrationImplementationPaths
		, ...optionalRepairHistoryRegistrationIntegrationPaths
	]) assert.ok(optionalRepairHistoryRegistrationNormalizationPaths
		.includes(path), path);
	const partition = await readFile(
		"tests/checked-javascript-partition-11.test.mjs", "utf8");
	assert.doesNotMatch(partition, /focused-producer-efficiency/u);
	assert.doesNotMatch(partition, /optional-parameter-wit-identity-repair/u);
	assert.doesNotMatch(partition, /optional-parameter-package-checker-repair/u);
	const names = [
		"focused-producer-efficiency"
		, "optional-parameter-wit-identity-repair"
		, "optional-parameter-package-checker-repair"
		, "optional-repair-history-registration"
	];
	const contractPath = "tests/optional-parameter-installed-contract.test.mjs";
	const contractUpdate = value.integrationUpdates.find(
		item => item.path === contractPath);
	assert.ok(contractUpdate);
	const milestoneContract = await sourceAtFinHistoryRecordSource(
		optionalRepairHistoryRegistrationHistoryPath, contractPath
		, contractUpdate.currentSha256);
	for(const name of names) assert.match(
		milestoneContract, new RegExp(name, "u"));
	const contract = await readFile(contractPath, "utf8");
	for(const name of names) assert.doesNotMatch(
		contract, new RegExp(name, "u"));
	const carrier = await readFile(
		"tests/canonical-package-manifest.test.mjs", "utf8");
	for(const name of names) assert.match(carrier, new RegExp(name, "u"));
});

test("optional repair history registration rejects forged history", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalRepairHistoryRegistrationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalRepairHistoryRegistrationUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-optional-repair-history-registration-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
