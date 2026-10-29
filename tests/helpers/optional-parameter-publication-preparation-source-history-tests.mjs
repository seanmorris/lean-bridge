/**
 * Qualify the optional-parameter publication preparation lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterPublicationPreparationSource
	, optionalParameterPublicationPreparationHistoryAdditions
	, optionalParameterPublicationPreparationHistoryPath
	, optionalParameterPublicationPreparationImplementation
	, optionalParameterPublicationPreparationImplementationAdditions
	, optionalParameterPublicationPreparationImplementationPaths
	, optionalParameterPublicationPreparationIntegrationPaths
	, optionalParameterPublicationPreparationNormalizationPaths
	, optionalParameterPublicationPreparationPredecessor
	, reverseOptionalParameterPublicationPreparationUpdate
} from "./optional-parameter-publication-preparation-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const exists = (revision, path) => spawnSync("git", ["cat-file", "-e"
	, `${revision}:${path}`], { stdio: "ignore" }).status === 0;
const record = async () => JSON.parse(await readFile(
	optionalParameterPublicationPreparationHistoryPath, "utf8"));

test("optional publication preparation records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-publication-preparation-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterPublicationPreparationPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterPublicationPreparationImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, [...optionalParameterPublicationPreparationImplementationPaths]);
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, [...optionalParameterPublicationPreparationImplementationAdditions]);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, [...optionalParameterPublicationPreparationIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("optional publication preparation reverses and authenticates implementation"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${optionalParameterPublicationPreparationImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${optionalParameterPublicationPreparationPredecessor}:${update.path}`]);
			assert.equal(reverseOptionalParameterPublicationPreparationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOptionalParameterPublicationPreparationSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const addition of value.implementationAdditions)
		{
			assert.equal(exists(optionalParameterPublicationPreparationPredecessor
				, addition.path), false, addition.path);
			assert.equal(sha256(git(["show"
				, `${optionalParameterPublicationPreparationImplementation}:${addition.path}`]))
				, addition.sha256, addition.path);
		}
	}
);

test("optional publication preparation authenticates isolated registration"
	, async () => {
		const value = await record();
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				optionalParameterPublicationPreparationHistoryPath, update.path
					, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterPublicationPreparationImplementation}:${update.path}`]);
			assert.equal(reverseOptionalParameterPublicationPreparationUpdate(
				current, update), previous, update.path);
		}
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterPublicationPreparationHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.equal(exists(optionalParameterPublicationPreparationImplementation
				, addition.path), false, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryRecordSource(
				optionalParameterPublicationPreparationHistoryPath, addition.path
					, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterPublicationPreparationImplementationPaths
			, ...optionalParameterPublicationPreparationIntegrationPaths
		]) assert.ok(optionalParameterPublicationPreparationNormalizationPaths
			.includes(path), path);
	}
);

test("optional publication preparation rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterPublicationPreparationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalParameterPublicationPreparationUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-publication-preparation-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
