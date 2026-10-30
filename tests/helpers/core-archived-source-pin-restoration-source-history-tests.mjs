/**
 * Authenticate restoration of immutable archived source snapshot pins.
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
	beforeCoreArchivedSourcePinRestorationSource
	, coreArchivedSourcePinRestorationBaseline
	, coreArchivedSourcePinRestorationCount
	, coreArchivedSourcePinRestorationHistoryAdditions
	, coreArchivedSourcePinRestorationHistoryPath
	, coreArchivedSourcePinRestorationImplementation
	, coreArchivedSourcePinRestorationImplementationPaths
	, coreArchivedSourcePinRestorationIntegrationPaths
	, coreArchivedSourcePinRestorationPredecessor
	, coreArchivedSourcePinRestorationTransitions
	, reverseCoreArchivedSourcePinRestorationUpdate
} from "./core-archived-source-pin-restoration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreArchivedSourcePinRestorationHistoryPath, "utf8"));

test("archived source-pin restoration records the exact Core failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-archived-source-pin-restoration-v1");
	assert.equal(history.predecessorCommit
		, coreArchivedSourcePinRestorationPredecessor);
	assert.equal(history.implementationCommit
		, coreArchivedSourcePinRestorationImplementation);
	assert.equal(history.baselineCommit
		, coreArchivedSourcePinRestorationBaseline);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreArchivedSourcePinRestorationImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreArchivedSourcePinRestorationIntegrationPaths);
	assert.deepEqual([history.failedRun, history.failedJob, history.restoredPins]
		, [41072790104, 124123412234
			, coreArchivedSourcePinRestorationCount]);
	assert.deepEqual(history.pinTransitions
		, coreArchivedSourcePinRestorationTransitions);
});

test("archived source-pin restoration reverses every modified source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				coreArchivedSourcePinRestorationImplementation, update.path), update)
			, true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${coreArchivedSourcePinRestorationImplementation}:${update.path}`]);
			assert.equal(reverseCoreArchivedSourcePinRestorationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCoreArchivedSourcePinRestorationSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("archived source-pin restoration retains exact live and historical counts"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, coreArchivedSourcePinRestorationHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const path = coreArchivedSourcePinRestorationImplementationPaths[0];
		const before = git(["show"
			, `${coreArchivedSourcePinRestorationPredecessor}:${path}`]);
		const after = git(["show"
			, `${coreArchivedSourcePinRestorationImplementation}:${path}`]);
		let restored = after;
		for(const transition of coreArchivedSourcePinRestorationTransitions)
		{
			assert.equal(restored.split(transition.archivedSha256).length - 1
				, transition.archivedCount, transition.path);
			assert.equal(restored.split(transition.liveSha256).length - 1
				, transition.liveCount, transition.path);
			restored = restored.replaceAll(transition.archivedSha256
				, transition.liveSha256);
		}
		assert.equal(restored, before);
		assert.equal(coreArchivedSourcePinRestorationTransitions
			.reduce((sum, item) => sum + item.archivedCount, 0)
		, coreArchivedSourcePinRestorationCount);
		const afterDocument = JSON.parse(after);
		const baselineDocument = JSON.parse(git(["show"
			, `${coreArchivedSourcePinRestorationBaseline}:${path}`]));
		assert.deepEqual(afterDocument.profiles, baselineDocument.profiles);
		assert.deepEqual(afterDocument.observations, baselineDocument.observations);
	}
);

test("archived source-pin restoration rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreArchivedSourcePinRestorationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.json" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreArchivedSourcePinRestorationUpdate(current, forged));
});

test("archived source-pin restoration writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-archived-source-pin-restoration-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /core-archived-source-pin-restoration-source-history-20261030\.json/u);
});
