/**
 * Authenticate the optional pin-test milestone repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeOptionalParameterPinTestMilestoneSource
	, optionalParameterPinTestMilestoneHistoryAdditions
	, optionalParameterPinTestMilestoneHistoryPath
	, optionalParameterPinTestMilestoneImplementation
	, optionalParameterPinTestMilestoneImplementationPaths
	, optionalParameterPinTestMilestoneIntegrationPaths
	, optionalParameterPinTestMilestonePredecessor
	, reverseOptionalParameterPinTestMilestoneUpdate
} from "./optional-parameter-pin-test-milestone-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterPinTestMilestoneHistoryPath, "utf8"));

test("optional pin-test repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "optional-parameter-pin-test-milestone-source-v1");
	assert.equal(history.predecessorCommit
		, optionalParameterPinTestMilestonePredecessor);
	assert.equal(history.implementationCommit
		, optionalParameterPinTestMilestoneImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, optionalParameterPinTestMilestoneImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, optionalParameterPinTestMilestoneIntegrationPaths);
	assert.equal(history.observedTest
		, "tests/checked-javascript-partition-11.test.mjs");
});

test("optional pin-test repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			optionalParameterPinTestMilestoneImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${optionalParameterPinTestMilestoneImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterPinTestMilestoneUpdate(
			current, update), previous, update.path);
		assert.equal(beforeOptionalParameterPinTestMilestoneSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("optional pin-test repair reads its immutable milestone", () => {
	const source = git(["show"
		, `${optionalParameterPinTestMilestoneImplementation}:${optionalParameterPinTestMilestoneImplementationPaths[0]}`]);
	assert.match(source
		, /optionalParameterPromotionIoPinRepairImplementation/u);
	assert.match(source, /git\(\["show"/u);
	assert.doesNotMatch(source, /readFile\("docs\/type-surface\.v1\.json"/u);
});

test("optional pin-test repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, optionalParameterPinTestMilestoneHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("optional pin-test repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${optionalParameterPinTestMilestoneImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseOptionalParameterPinTestMilestoneUpdate(current, forged));
});

test("optional pin-test writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-optional-parameter-pin-test-milestone-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /optional-parameter-pin-test-milestone-source-history-20261030\.json/u);
});
