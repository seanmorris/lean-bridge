/**
 * Authenticate the final-audit registration and static preflight repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { collectCoreContractTestPaths, coreContractShardLabels
	, coreContractShardManifest, verifyCoreContractShardManifests }
	from "../../scripts/core-contract-shards.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeCoreFinalAuditRegistrationSource
	, coreFinalAuditRegistrationHistoryAdditions
	, coreFinalAuditRegistrationHistoryPath
	, coreFinalAuditRegistrationImplementation
	, coreFinalAuditRegistrationImplementationPaths
	, coreFinalAuditRegistrationIntegrationPaths
	, coreFinalAuditRegistrationPins
	, coreFinalAuditRegistrationPredecessor
	, coreFinalAuditRegistrationTest
	, reverseCoreFinalAuditRegistrationUpdate
} from "./core-final-audit-registration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreFinalAuditRegistrationHistoryPath, "utf8"));

test("final-audit registration records the complete preflight defect", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-final-audit-registration-source-v1");
	assert.equal(history.predecessorCommit
		, coreFinalAuditRegistrationPredecessor);
	assert.equal(history.implementationCommit
		, coreFinalAuditRegistrationImplementation);
	assert.equal(history.registeredTest, coreFinalAuditRegistrationTest);
	assert.equal(history.detectedFailure
		, "Unclassified repository test: tests/core-final-type-surface-audit-source-history.test.mjs");
	assert.equal(history.detectedBeforeHostedShardExecution, true);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreFinalAuditRegistrationImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreFinalAuditRegistrationIntegrationPaths);
});

test("final-audit registration reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreFinalAuditRegistrationImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreFinalAuditRegistrationImplementation}:${update.path}`]);
		assert.equal(reverseCoreFinalAuditRegistrationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreFinalAuditRegistrationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("final-audit registration closes its profile, preflight and live pins", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(addition => addition.path)
		, coreFinalAuditRegistrationHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const inventoryPath = coreFinalAuditRegistrationImplementationPaths[0];
	const before = git(["show"
		, `${coreFinalAuditRegistrationPredecessor}:${inventoryPath}`]);
	const after = git(["show"
		, `${coreFinalAuditRegistrationImplementation}:${inventoryPath}`]);
	let restored = after;
	for(const pin of coreFinalAuditRegistrationPins)
	{
		restored = restored.replaceAll(pin.current, pin.previous);
		assert.equal(after.split(pin.current).length - 1, pin.count);
		assert.equal(after.includes(pin.previous), false);
	}
	assert.equal(restored, before);
	const paths = await collectCoreContractTestPaths();
	assert.equal(paths.length, history.contractFiles);
	assert.ok(paths.includes(
		`tests/${coreFinalAuditRegistrationTest}.test.mjs`));
	assert.equal(verifyCoreContractShardManifests(paths
		, coreContractShardLabels.map(label =>
			coreContractShardManifest(paths, label))).contractSha256
	, history.contractSha256);
	const packageDocument = JSON.parse(await readFile("package.json", "utf8"));
	assert.match(packageDocument.scripts["env:check:core"]
		, /inventory\.sh --profile core.*test-profiles\.test\.mjs/u);
});

test("final-audit registration rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreFinalAuditRegistrationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.json" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreFinalAuditRegistrationUpdate(current, forged));
});

test("final-audit registration writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-final-audit-registration-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /core-final-audit-registration-source-history-20261031\.json/u);
});
