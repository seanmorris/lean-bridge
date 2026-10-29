/**
 * Qualify the optional-parameter promotion contract preparation lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterPromotionContractSource
	, optionalParameterPromotionContractHistoryAdditions
	, optionalParameterPromotionContractHistoryPath
	, optionalParameterPromotionContractImplementation
	, optionalParameterPromotionContractImplementationAdditions
	, optionalParameterPromotionContractImplementationPaths
	, optionalParameterPromotionContractIntegrationPaths
	, optionalParameterPromotionContractNormalizationPaths
	, optionalParameterPromotionContractPredecessor
	, reverseOptionalParameterPromotionContractUpdate
} from "./optional-parameter-promotion-contract-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const exists = (revision, path) => spawnSync("git", ["cat-file", "-e"
	, `${revision}:${path}`], { stdio: "ignore" }).status === 0;
const record = async () => JSON.parse(await readFile(
	optionalParameterPromotionContractHistoryPath, "utf8"));

test("optional promotion contract records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-parameter-promotion-contract-source-v1");
	assert.equal(value.predecessorCommit
		, optionalParameterPromotionContractPredecessor);
	assert.equal(value.implementationCommit
		, optionalParameterPromotionContractImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, [...optionalParameterPromotionContractImplementationPaths]);
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, [...optionalParameterPromotionContractImplementationAdditions]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, [...optionalParameterPromotionContractIntegrationPaths]);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
});

test("optional promotion contract reverses and authenticates implementation"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${optionalParameterPromotionContractImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${optionalParameterPromotionContractPredecessor}:${update.path}`]);
			assert.equal(reverseOptionalParameterPromotionContractUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOptionalParameterPromotionContractSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const addition of value.implementationAdditions)
		{
			assert.equal(exists(optionalParameterPromotionContractPredecessor
				, addition.path), false, addition.path);
			assert.equal(sha256(git(["show"
				, `${optionalParameterPromotionContractImplementation}:${addition.path}`]))
				, addition.sha256, addition.path);
		}
	}
);

test("optional promotion contract authenticates isolated registration"
	, async () => {
		const value = await record();
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				optionalParameterPromotionContractHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterPromotionContractImplementation}:${update.path}`]);
			assert.equal(reverseOptionalParameterPromotionContractUpdate(
				current, update), previous, update.path);
		}
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterPromotionContractHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.equal(exists(optionalParameterPromotionContractImplementation
				, addition.path), false, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryRecordSource(
				optionalParameterPromotionContractHistoryPath, addition.path
				, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterPromotionContractImplementationPaths
			, ...optionalParameterPromotionContractIntegrationPaths
		]) assert.ok(optionalParameterPromotionContractNormalizationPaths
			.includes(path), path);
	}
);

test("optional promotion contract rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterPromotionContractImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalParameterPromotionContractUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-promotion-contract-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
