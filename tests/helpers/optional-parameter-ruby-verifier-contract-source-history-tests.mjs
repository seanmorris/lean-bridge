/**
 * Qualify the optional-parameter Ruby verifier contract repair lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterRubyVerifierContractSource
	, optionalParameterRubyVerifierContractHistoryAdditions
	, optionalParameterRubyVerifierContractHistoryPath
	, optionalParameterRubyVerifierContractImplementation
	, optionalParameterRubyVerifierContractImplementationPaths
	, optionalParameterRubyVerifierContractIntegrationPaths
	, optionalParameterRubyVerifierContractNormalizationPaths
	, optionalParameterRubyVerifierContractPredecessor
	, reverseOptionalParameterRubyVerifierContractUpdate
} from "./optional-parameter-ruby-verifier-contract-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterRubyVerifierContractHistoryPath, "utf8"));

test("optional Ruby verifier repair records its exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-parameter-ruby-verifier-contract-source-v1");
	assert.equal(value.predecessorCommit
		, optionalParameterRubyVerifierContractPredecessor);
	assert.equal(value.implementationCommit
		, optionalParameterRubyVerifierContractImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, [...optionalParameterRubyVerifierContractImplementationPaths]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, [...optionalParameterRubyVerifierContractIntegrationPaths]);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
});

test("optional Ruby verifier repair reverses every exact source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterRubyVerifierContractImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterRubyVerifierContractPredecessor}:${update.path}`]);
		assert.equal(reverseOptionalParameterRubyVerifierContractUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterRubyVerifierContractSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			optionalParameterRubyVerifierContractHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${optionalParameterRubyVerifierContractImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterRubyVerifierContractUpdate(
			current, update), previous, update.path);
	}
});

test("optional Ruby verifier repair authenticates isolated registration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterRubyVerifierContractHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterRubyVerifierContractImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryRecordSource(
				optionalParameterRubyVerifierContractHistoryPath, addition.path
					, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterRubyVerifierContractImplementationPaths
			, ...optionalParameterRubyVerifierContractIntegrationPaths
		]) assert.ok(optionalParameterRubyVerifierContractNormalizationPaths
			.includes(path), path);
	}
);

test("optional Ruby verifier repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterRubyVerifierContractImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseOptionalParameterRubyVerifierContractUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-ruby-verifier-contract-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
