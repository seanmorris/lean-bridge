/**
 * Authenticate the final Core test-registration repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { coreContractShardLabels, coreContractShardManifest
	, verifyCoreContractShardManifests }
	from "../../scripts/core-contract-shards.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeCoreFinalTestRegistrationSource
	, coreFinalTestRegistrationHistoryAdditions
	, coreFinalTestRegistrationHistoryPath
	, coreFinalTestRegistrationImplementation
	, coreFinalTestRegistrationImplementationPaths
	, coreFinalTestRegistrationIntegrationPaths
	, coreFinalTestRegistrationPins
	, coreFinalTestRegistrationPredecessor
	, coreFinalTestRegistrationTests
	, reverseCoreFinalTestRegistrationUpdate
} from "./core-final-test-registration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreFinalTestRegistrationHistoryPath, "utf8"));

test("final Core test repair records the exact shared shard failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-final-test-registration-source-v1");
	assert.equal(history.predecessorCommit, coreFinalTestRegistrationPredecessor);
	assert.equal(history.implementationCommit
		, coreFinalTestRegistrationImplementation);
	assert.deepEqual(history.failedJobs, [124159992526, 124159992687]);
	assert.equal(history.failedRun, 41079000565);
	assert.equal(history.failedTest
		, "tests/dependent-signature-complete-hosted-evidence.test.mjs");
	assert.deepEqual(history.registeredTests, coreFinalTestRegistrationTests);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreFinalTestRegistrationImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreFinalTestRegistrationIntegrationPaths);
});

test("final Core test repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreFinalTestRegistrationImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreFinalTestRegistrationImplementation}:${update.path}`]);
		assert.equal(reverseCoreFinalTestRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreFinalTestRegistrationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("final Core test repair closes all nine registrations and 102 pins", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, coreFinalTestRegistrationHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const inventoryPath = coreFinalTestRegistrationImplementationPaths[0];
	const before = git(["show"
		, `${coreFinalTestRegistrationPredecessor}:${inventoryPath}`]);
	const after = git(["show"
		, `${coreFinalTestRegistrationImplementation}:${inventoryPath}`]);
	let restored = after;
	for(const pin of coreFinalTestRegistrationPins)
	{
		restored = restored.replaceAll(pin.current, pin.previous);
		assert.equal(after.split(pin.current).length - 1, pin.count);
		assert.equal(after.includes(pin.previous), false);
	}
	assert.equal(restored, before);
	const beforeDocument = JSON.parse(before), afterDocument = JSON.parse(after);
	assert.deepEqual(afterDocument.profiles, beforeDocument.profiles);
	assert.deepEqual(afterDocument.observations, beforeDocument.observations);
	const historicalProfileSource = git(["show"
		, `${coreFinalTestRegistrationImplementation}:src/adoption/test-profiles.mjs`]);
	const historicalProfile = await import("data:text/javascript;base64,"
		+ Buffer.from(historicalProfileSource).toString("base64"));
	const paths = historicalProfile.groupRepositoryTests(git([
		"ls-tree", "-r", "--name-only"
		, coreFinalTestRegistrationImplementation, "--", "tests"
	]).trim().split("\n").filter(path => path.endsWith(".test.mjs"))
		.toSorted()).contract;
	assert.equal(paths.length, history.contractFiles);
	for(const name of coreFinalTestRegistrationTests)
		assert.ok(paths.includes(`tests/${name}.test.mjs`), name);
	assert.equal(verifyCoreContractShardManifests(paths
		, coreContractShardLabels.map(label =>
			coreContractShardManifest(paths, label))).contractSha256
	, history.contractSha256);
});

test("final Core test repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreFinalTestRegistrationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.json" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreFinalTestRegistrationUpdate(current, forged));
});

test("final Core test repair writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-final-test-registration-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /core-final-test-registration-source-history-20261030\.json/u);
});
