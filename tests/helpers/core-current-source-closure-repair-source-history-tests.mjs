/**
 * Authenticate the complete current-source pin closure exposed by final Core.
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
	beforeCoreCurrentSourceClosureRepairSource
	, coreCurrentSourceClosureRepairHistoryAdditions
	, coreCurrentSourceClosureRepairHistoryPath
	, coreCurrentSourceClosureRepairImplementation
	, coreCurrentSourceClosureRepairImplementationPaths
	, coreCurrentSourceClosureRepairIntegrationPaths
	, coreCurrentSourceClosureRepairPinTransitions
	, coreCurrentSourceClosureRepairPredecessor
	, coreCurrentSourceClosureRepairRefreshedPins
	, reverseCoreCurrentSourceClosureRepairUpdate
} from "./core-current-source-closure-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreCurrentSourceClosureRepairHistoryPath, "utf8"));

test("current-source closure repair records the exact Core failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-current-source-closure-repair-v1");
	assert.equal(history.predecessorCommit
		, coreCurrentSourceClosureRepairPredecessor);
	assert.equal(history.implementationCommit
		, coreCurrentSourceClosureRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreCurrentSourceClosureRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreCurrentSourceClosureRepairIntegrationPaths);
	assert.deepEqual([history.failedRun, history.failedJob, history.refreshedPins]
		, [41066785875, 124102407122
			, coreCurrentSourceClosureRepairRefreshedPins]);
	assert.deepEqual(history.pinTransitions
		, coreCurrentSourceClosureRepairPinTransitions);
});

test("current-source closure repair reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreCurrentSourceClosureRepairImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreCurrentSourceClosureRepairImplementation}:${update.path}`]);
		assert.equal(reverseCoreCurrentSourceClosureRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreCurrentSourceClosureRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("current-source closure repair changes exactly nine paths and 1,135 pins"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, coreCurrentSourceClosureRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const path = coreCurrentSourceClosureRepairImplementationPaths[0];
		const before = git(["show"
			, `${coreCurrentSourceClosureRepairPredecessor}:${path}`]);
		const after = git(["show"
			, `${coreCurrentSourceClosureRepairImplementation}:${path}`]);
		let restored = after;
		for(const transition of coreCurrentSourceClosureRepairPinTransitions)
		{
			assert.equal(restored.includes(transition.previousSha256), false);
			assert.equal(restored.split(transition.currentSha256).length - 1
				, transition.count, transition.path);
			restored = restored.replaceAll(transition.currentSha256
				, transition.previousSha256);
		}
		assert.equal(restored, before);
		assert.equal(coreCurrentSourceClosureRepairPinTransitions
			.reduce((sum, item) => sum + item.count, 0)
		, coreCurrentSourceClosureRepairRefreshedPins);
		const beforeDocument = JSON.parse(before);
		const afterDocument = JSON.parse(after);
		assert.deepEqual(afterDocument.profiles, beforeDocument.profiles);
		assert.deepEqual(afterDocument.observations, beforeDocument.observations);
	}
);

test("current-source closure repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreCurrentSourceClosureRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.json" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreCurrentSourceClosureRepairUpdate(current, forged));
});

test("current-source closure repair writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-current-source-closure-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /core-current-source-closure-repair-source-history-20261030\.json/u);
});
