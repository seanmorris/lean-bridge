/**
 * Qualify the optional-parameter PHP binding-identity repair lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterPhpBindingIdentitySource
	, optionalParameterPhpBindingIdentityHistoryAdditions
	, optionalParameterPhpBindingIdentityHistoryPath
	, optionalParameterPhpBindingIdentityImplementation
	, optionalParameterPhpBindingIdentityImplementationPaths
	, optionalParameterPhpBindingIdentityIntegrationPaths
	, optionalParameterPhpBindingIdentityNormalizationPaths
	, optionalParameterPhpBindingIdentityPredecessor
	, reverseOptionalParameterPhpBindingIdentityUpdate
} from "./optional-parameter-php-binding-identity-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterPhpBindingIdentityHistoryPath, "utf8"));

test("optional PHP binding identity repair records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "optional-parameter-php-binding-identity-source-v1");
		assert.equal(value.predecessorCommit
			, optionalParameterPhpBindingIdentityPredecessor);
		assert.equal(value.implementationCommit
			, optionalParameterPhpBindingIdentityImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, [...optionalParameterPhpBindingIdentityImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, [...optionalParameterPhpBindingIdentityIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("optional PHP binding identity repair reverses every exact source"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${optionalParameterPhpBindingIdentityImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${optionalParameterPhpBindingIdentityPredecessor}:${update.path}`]);
			assert.equal(reverseOptionalParameterPhpBindingIdentityUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOptionalParameterPhpBindingIdentitySource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				optionalParameterPhpBindingIdentityHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${optionalParameterPhpBindingIdentityImplementation}:${update.path}`]);
			assert.equal(reverseOptionalParameterPhpBindingIdentityUpdate(
				current, update), previous, update.path);
		}
	}
);

test("optional PHP binding identity repair authenticates registration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, [...optionalParameterPhpBindingIdentityHistoryAdditions]);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${optionalParameterPhpBindingIdentityImplementation}:`
					+ addition.path], { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryRecordSource(
				optionalParameterPhpBindingIdentityHistoryPath, addition.path
					, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of [
			...optionalParameterPhpBindingIdentityImplementationPaths
			, ...optionalParameterPhpBindingIdentityIntegrationPaths
		]) assert.ok(optionalParameterPhpBindingIdentityNormalizationPaths
			.includes(path), path);
	}
);

test("optional PHP binding identity repair rejects forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${optionalParameterPhpBindingIdentityImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseOptionalParameterPhpBindingIdentityUpdate(
			current, forged));
		const result = spawnSync(process.execPath, [
			"scripts/update-optional-parameter-php-binding-identity-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(result.status, 0);
	}
);
