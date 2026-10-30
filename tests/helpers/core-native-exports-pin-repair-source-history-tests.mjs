/**
 * Authenticate the exact NativeExports live-pin repair exposed by final Core.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeCoreNativeExportsPinRepairSource
	, coreNativeExportsPinRepairCurrentDigest
	, coreNativeExportsPinRepairHistoryAdditions
	, coreNativeExportsPinRepairHistoryPath
	, coreNativeExportsPinRepairImplementation
	, coreNativeExportsPinRepairImplementationPaths
	, coreNativeExportsPinRepairIntegrationPaths
	, coreNativeExportsPinRepairPredecessor
	, coreNativeExportsPinRepairPreviousDigest
	, coreNativeExportsPinRepairRefreshedPins
	, coreNativeExportsPinRepairSourcePath
	, reverseCoreNativeExportsPinRepairUpdate
} from "./core-native-exports-pin-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreNativeExportsPinRepairHistoryPath, "utf8"));

test("NativeExports pin repair records the exact Core failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-native-exports-pin-repair-source-v1");
	assert.equal(history.predecessorCommit
		, coreNativeExportsPinRepairPredecessor);
	assert.equal(history.implementationCommit
		, coreNativeExportsPinRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreNativeExportsPinRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreNativeExportsPinRepairIntegrationPaths);
	assert.deepEqual([history.failedRun, history.failedJob, history.refreshedPins]
		, [41066785875, 124102407122
			, coreNativeExportsPinRepairRefreshedPins]);
	assert.deepEqual([
		history.sourcePath, history.previousDigest, history.currentDigest
	], [
		coreNativeExportsPinRepairSourcePath
		, coreNativeExportsPinRepairPreviousDigest
		, coreNativeExportsPinRepairCurrentDigest
	]);
});

test("NativeExports pin repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreNativeExportsPinRepairImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreNativeExportsPinRepairImplementation}:${update.path}`]);
		assert.equal(reverseCoreNativeExportsPinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreNativeExportsPinRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("NativeExports pin repair changes exactly 155 live citations", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, coreNativeExportsPinRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const path = coreNativeExportsPinRepairImplementationPaths[0];
	const before = git(["show"
		, `${coreNativeExportsPinRepairPredecessor}:${path}`]);
	const after = git(["show"
		, `${coreNativeExportsPinRepairImplementation}:${path}`]);
	assert.equal(after.replaceAll(coreNativeExportsPinRepairCurrentDigest
		, coreNativeExportsPinRepairPreviousDigest), before);
	assert.equal(after.split(coreNativeExportsPinRepairCurrentDigest).length - 1
		, coreNativeExportsPinRepairRefreshedPins);
	assert.equal(after.includes(coreNativeExportsPinRepairPreviousDigest), false);
	const beforeDocument = JSON.parse(before);
	const afterDocument = JSON.parse(after);
	assert.deepEqual(afterDocument.profiles, beforeDocument.profiles);
	assert.deepEqual(afterDocument.observations, beforeDocument.observations);
});

test("NativeExports pin repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreNativeExportsPinRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.json" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreNativeExportsPinRepairUpdate(current, forged));
});

test("NativeExports pin repair writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-native-exports-pin-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /core-native-exports-pin-repair-source-history-20261030\.json/u);
});
