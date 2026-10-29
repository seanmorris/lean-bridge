/**
 * Qualify the optional-parameter WIT package-identity repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterWitIdentityRepairSource
	, optionalParameterWitIdentityRepairHistoryAdditions
	, optionalParameterWitIdentityRepairHistoryPath
	, optionalParameterWitIdentityRepairImplementation
	, optionalParameterWitIdentityRepairImplementationPaths
	, optionalParameterWitIdentityRepairIntegrationPaths
	, optionalParameterWitIdentityRepairNormalizationPaths
	, optionalParameterWitIdentityRepairPredecessor
	, reverseOptionalParameterWitIdentityRepairUpdate
} from "./optional-parameter-wit-identity-repair-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterWitIdentityRepairHistoryPath, "utf8"));

test("optional WIT identity repair records one exact implementation", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-parameter-wit-identity-repair-source-v1");
	assert.equal(value.predecessorCommit
		, optionalParameterWitIdentityRepairPredecessor);
	assert.equal(value.implementationCommit
		, optionalParameterWitIdentityRepairImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, [...optionalParameterWitIdentityRepairImplementationPaths]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, [...optionalParameterWitIdentityRepairIntegrationPaths]);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.equal(value.refreshedPins, 0);
});

test("optional WIT identity repair reverses implementation and registration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${optionalParameterWitIdentityRepairImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${optionalParameterWitIdentityRepairPredecessor}:${update.path}`]);
			assert.equal(reverseOptionalParameterWitIdentityRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOptionalParameterWitIdentityRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterWitIdentityRepairImplementation}:${update.path}`]);
			assert.equal(reverseOptionalParameterWitIdentityRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("optional WIT identity repair authenticates identity semantics", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...optionalParameterWitIdentityRepairHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalParameterWitIdentityRepairImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	}
	for(const path of [
		...optionalParameterWitIdentityRepairImplementationPaths
		, ...optionalParameterWitIdentityRepairIntegrationPaths
	]) assert.ok(optionalParameterWitIdentityRepairNormalizationPaths
		.includes(path), path);
	const source = git(["show"
		, `${optionalParameterWitIdentityRepairImplementation}:`
			+ "tests/optional-parameter-wit-installed.test.mjs"]);
	assert.match(source, /`wit\/\$\{pkg\.name\}\.wit`/u);
	assert.doesNotMatch(source, /wit\/defaults\.wit/u);
});

test("optional WIT identity repair rejects forged history and updater misuse"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${optionalParameterWitIdentityRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseOptionalParameterWitIdentityRepairUpdate(
			current, forged));
		const result = spawnSync(process.execPath, [
			"scripts/update-optional-parameter-wit-identity-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(result.status, 0);
	}
);
