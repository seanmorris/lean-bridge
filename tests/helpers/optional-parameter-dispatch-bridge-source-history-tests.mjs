/**
 * Qualify the registered focused optional-parameter dispatch bridge.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterDispatchBridgeSource
	, optionalParameterDispatchBridgeHistoryAdditions
	, optionalParameterDispatchBridgeHistoryPath
	, optionalParameterDispatchBridgeImplementation
	, optionalParameterDispatchBridgeImplementationPaths
	, optionalParameterDispatchBridgeIntegrationPaths
	, optionalParameterDispatchBridgeNormalizationPaths
	, optionalParameterDispatchBridgePredecessor
	, reverseOptionalParameterDispatchBridgeUpdate
} from "./optional-parameter-dispatch-bridge-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterDispatchBridgeHistoryPath, "utf8"));

test("optional dispatch bridge records its exact implementation parent"
	, async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-parameter-dispatch-bridge-source-v1");
	assert.equal(value.predecessorCommit
		, optionalParameterDispatchBridgePredecessor);
	assert.equal(value.implementationCommit
		, optionalParameterDispatchBridgeImplementation);
	assert.equal(git(["rev-parse"
		, `${optionalParameterDispatchBridgeImplementation}^`]).trim()
		, optionalParameterDispatchBridgePredecessor);
	}
);

test("optional dispatch bridge reverses every implementation source"
	, async () => {
	const value = await record();
	assert.deepEqual(value.updates.map(update => update.path)
		, [...optionalParameterDispatchBridgeImplementationPaths]);
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterDispatchBridgeImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterDispatchBridgePredecessor}:${update.path}`]);
		assert.equal(reverseOptionalParameterDispatchBridgeUpdate(current, update)
			, previous, update.path);
	}
	}
);

test("optional dispatch bridge registration is exactly reversible"
	, async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...optionalParameterDispatchBridgeIntegrationPaths]);
	for(const update of value.integrationUpdates)
	{
		const live = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const implementation = git(["show"
			, `${optionalParameterDispatchBridgeImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterDispatchBridgeUpdate(live, update)
			, implementation, update.path);
	}
	}
);

test("optional dispatch bridge owns no promoted type-surface source pins"
	, async () => {
	const value = await record();
	assert.equal(value.refreshedPins, 0);
	assert.deepEqual(value.currentSourcePaths, []);
	assert.deepEqual(value.currentSourceDigests, []);
	assert.deepEqual(value.currentSourceDigests.map(item => item.path)
		, value.currentSourcePaths);
	}
);

test("optional dispatch bridge authenticates every history control"
	, async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...optionalParameterDispatchBridgeHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalParameterDispatchBridgeImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256))
			, addition.sha256, addition.path);
	}
	for(const path of [
		...optionalParameterDispatchBridgeImplementationPaths
		, ...optionalParameterDispatchBridgeIntegrationPaths
	]) assert.ok(optionalParameterDispatchBridgeNormalizationPaths.includes(path)
		, path);
	}
);

test("optional dispatch bridge normalizes current sources to its predecessor"
	, async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const live = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = beforeOptionalParameterDispatchBridgeSource(
			update.path, live, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}
	}
);
