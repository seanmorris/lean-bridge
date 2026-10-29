/**
 * Qualify isolation of current repairs from the historical Fin hub.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCurrentRepairHistoryIsolationSource
	, currentRepairHistoryIsolationHistoryAdditions
	, currentRepairHistoryIsolationHistoryPath
	, currentRepairHistoryIsolationImplementation
	, currentRepairHistoryIsolationImplementationPaths
	, currentRepairHistoryIsolationIntegrationPaths
	, currentRepairHistoryIsolationNormalizationPaths
	, currentRepairHistoryIsolationPredecessor
	, reverseCurrentRepairHistoryIsolationUpdate
} from "./current-repair-history-isolation-source-history.mjs";
import { sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	currentRepairHistoryIsolationHistoryPath, "utf8"));

test("current repair history isolation records its exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "current-repair-history-isolation-source-v1");
		assert.equal(value.predecessorCommit
			, currentRepairHistoryIsolationPredecessor);
		assert.equal(value.implementationCommit
			, currentRepairHistoryIsolationImplementation);
		assert.deepEqual(value.updates.map(item => item.path)
			, [...currentRepairHistoryIsolationImplementationPaths]);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, [...currentRepairHistoryIsolationIntegrationPaths]);
		assert.deepEqual(value.currentSourcePaths, []);
		assert.equal(value.refreshedPins, 0);
	}
);

test("current repair history isolation reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${currentRepairHistoryIsolationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${currentRepairHistoryIsolationPredecessor}:${update.path}`]);
		assert.equal(reverseCurrentRepairHistoryIsolationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCurrentRepairHistoryIsolationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			currentRepairHistoryIsolationHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${currentRepairHistoryIsolationImplementation}:${update.path}`]);
		assert.equal(reverseCurrentRepairHistoryIsolationUpdate(
			current, update), previous, update.path);
	}
});

test("current repair history isolation preserves exact boundaries", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...currentRepairHistoryIsolationHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${currentRepairHistoryIsolationImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0);
		assert.equal(sha256(await sourceAtFinHistoryRecordSource(
			currentRepairHistoryIsolationHistoryPath, addition.path
			, addition.sha256)), addition.sha256, addition.path);
	}
	for(const path of [
		...currentRepairHistoryIsolationImplementationPaths
		, ...currentRepairHistoryIsolationIntegrationPaths
	]) assert.ok(currentRepairHistoryIsolationNormalizationPaths.includes(path)
		, path);
	for(const path of [
		"tests/helpers/fin-refinement-source-history.mjs"
		, "tests/checked-javascript-partition-11.test.mjs"
	]) assert.equal(sha256(await readFile(path)), sha256(git(["show"
		, `6cf8e53b1a5015c2d3e3f7100e14fdf4a4caf3f4:${path}`])), path);
	const optional = await readFile(
		"tests/optional-parameter-installed-contract.test.mjs", "utf8");
	assert.doesNotMatch(optional, /focused-producer-efficiency/u);
	const carrier = await readFile(
		"tests/canonical-package-manifest.test.mjs", "utf8");
	for(const name of [
		"current-repair-history-isolation", "focused-producer-efficiency"
		, "optional-parameter-wit-identity-repair"
		, "optional-parameter-package-checker-repair"
		, "optional-repair-history-registration"
	]) assert.match(carrier, new RegExp(name, "u"));
});

test("current repair history isolation rejects forged history", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${currentRepairHistoryIsolationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCurrentRepairHistoryIsolationUpdate(
		current, forged));
	const result = spawnSync(process.execPath, [
		"scripts/update-current-repair-history-isolation-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
});
