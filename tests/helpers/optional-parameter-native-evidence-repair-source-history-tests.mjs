/**
 * Qualify optional-parameter native evidence repair history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterNativeEvidenceRepairSource
	, optionalParameterNativeEvidenceRepairHistoryAdditions
	, optionalParameterNativeEvidenceRepairHistoryPath
	, optionalParameterNativeEvidenceRepairImplementation
	, optionalParameterNativeEvidenceRepairImplementationPaths
	, optionalParameterNativeEvidenceRepairIntegrationPaths
	, optionalParameterNativeEvidenceRepairNormalizationPaths
	, optionalParameterNativeEvidenceRepairPredecessor
	, reverseOptionalParameterNativeEvidenceRepairUpdate
} from "./optional-parameter-native-evidence-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterNativeEvidenceRepairHistoryPath, "utf8"));

test("optional native evidence repair records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-parameter-native-evidence-repair-source-v1");
	assert.equal(value.predecessorCommit
		, optionalParameterNativeEvidenceRepairPredecessor);
	assert.equal(value.implementationCommit
		, optionalParameterNativeEvidenceRepairImplementation);
	assert.equal(git(["rev-parse"
		, `${optionalParameterNativeEvidenceRepairImplementation}^`]).trim()
		, optionalParameterNativeEvidenceRepairPredecessor);
	assert.deepEqual(value.updates.map(update => update.path)
		, [...optionalParameterNativeEvidenceRepairImplementationPaths]);
});

test("optional native evidence repair reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterNativeEvidenceRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterNativeEvidenceRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOptionalParameterNativeEvidenceRepairUpdate(
			current, update), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const implementation = git(["show"
			, `${optionalParameterNativeEvidenceRepairImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterNativeEvidenceRepairUpdate(
			await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256), update)
			, implementation, update.path);
	}
});

test("optional native evidence repair owns no live source pins", async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...optionalParameterNativeEvidenceRepairIntegrationPaths]);
	assert.equal(value.refreshedPins, 0);
	assert.deepEqual(value.currentSourcePaths, []);
});

test("optional native evidence repair authenticates its history controls"
	, async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...optionalParameterNativeEvidenceRepairHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalParameterNativeEvidenceRepairImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256))
			, addition.sha256, addition.path);
	}
	for(const path of [
		...optionalParameterNativeEvidenceRepairImplementationPaths
		, ...optionalParameterNativeEvidenceRepairIntegrationPaths
	]) assert.ok(optionalParameterNativeEvidenceRepairNormalizationPaths
		.includes(path), path);
	}
);

test("optional native evidence repair normalizes to its predecessor", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const previous = beforeOptionalParameterNativeEvidenceRepairSource(
			update.path, await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256)
			, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}
});

test("optional native evidence repair binds real compiler profile records", () => {
	const implementation = path => git(["show"
		, `${optionalParameterNativeEvidenceRepairImplementation}:${path}`]);
	for(const lane of ["language", "managed", "native", "wit"])
	{
		const source = implementation(
			`tests/optional-parameter-${lane}-installed.test.mjs`);
		assert.match(source, /assertOptionalParameterNativeComponent/u, lane);
		assert.doesNotMatch(source, /join\(outputRoot, "bundle"\)/u, lane);
	}
	const php = implementation("tests/optional-parameter-php-installed.test.mjs");
	assert.match(php, /assertOptionalParameterPhpComponents/u);
	assert.doesNotMatch(php, /join\(outputRoot, "bundle"\)/u);
});
