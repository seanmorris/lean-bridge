/**
 * Qualify the optional-parameter installed checker repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterPackageCheckerRepairSource
	, optionalParameterPackageCheckerRepairHistoryAdditions
	, optionalParameterPackageCheckerRepairHistoryPath
	, optionalParameterPackageCheckerRepairImplementation
	, optionalParameterPackageCheckerRepairImplementationPaths
	, optionalParameterPackageCheckerRepairIntegrationPaths
	, optionalParameterPackageCheckerRepairNormalizationPaths
	, optionalParameterPackageCheckerRepairPredecessor
	, reverseOptionalParameterPackageCheckerRepairUpdate
} from "./optional-parameter-package-checker-repair-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterPackageCheckerRepairHistoryPath, "utf8"));

test("optional package checker repair records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-package-checker-repair-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterPackageCheckerRepairPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterPackageCheckerRepairImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, [...optionalParameterPackageCheckerRepairImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, [...optionalParameterPackageCheckerRepairIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("optional package checker repair reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterPackageCheckerRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterPackageCheckerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOptionalParameterPackageCheckerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterPackageCheckerRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			optionalParameterPackageCheckerRepairHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${optionalParameterPackageCheckerRepairImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterPackageCheckerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterPackageCheckerRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("optional package checker repair retains exact contracts", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...optionalParameterPackageCheckerRepairHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalParameterPackageCheckerRepairImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0);
		assert.equal(sha256(await sourceAtFinHistoryRecordSource(
			optionalParameterPackageCheckerRepairHistoryPath, addition.path
			, addition.sha256)), addition.sha256, addition.path);
	}
	for(const path of [
		...optionalParameterPackageCheckerRepairImplementationPaths
		, ...optionalParameterPackageCheckerRepairIntegrationPaths
	]) assert.ok(optionalParameterPackageCheckerRepairNormalizationPaths
		.includes(path), path);
	const contract = git(["show"
		, `${optionalParameterPackageCheckerRepairImplementation}:`
			+ "tests/helpers/optional-parameter-installed-contract.mjs"]);
	assert.match(contract, /optionalParameterPythonPatterns/u);
	assert.match(contract, /optionalParameterRubyPatterns/u);
	assert.match(contract, /optionalParameterCppPattern/u);
	assert.match(contract, /can\(\?:not\| not\)/u);
});

test("optional package checker repair rejects forged history", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterPackageCheckerRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalParameterPackageCheckerRepairUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-package-checker-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
