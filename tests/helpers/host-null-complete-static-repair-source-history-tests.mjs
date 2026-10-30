/**
 * Authenticate the complete HostNull verifier lint and live-pin repair.
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
	beforeHostNullCompleteStaticRepairSource
	, hostNullCompleteStaticRepairHistoryAdditions
	, hostNullCompleteStaticRepairHistoryPath
	, hostNullCompleteStaticRepairImplementation
	, hostNullCompleteStaticRepairImplementationPaths
	, hostNullCompleteStaticRepairIntegrationPaths
	, hostNullCompleteStaticRepairPredecessor
	, reverseHostNullCompleteStaticRepairUpdate
} from "./host-null-complete-static-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullCompleteStaticRepairHistoryPath, "utf8"));

test("complete HostNull static repair records its exact failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "host-null-complete-static-repair-source-v1");
	assert.equal(history.predecessorCommit
		, hostNullCompleteStaticRepairPredecessor);
	assert.equal(history.implementationCommit
		, hostNullCompleteStaticRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, hostNullCompleteStaticRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, hostNullCompleteStaticRepairIntegrationPaths);
	assert.deepEqual([history.failedRun, history.failedJob, history.refreshedPins]
		, [41065734932, 124096528010, 1]);
});

test("complete HostNull static repair reverses every modified source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				hostNullCompleteStaticRepairImplementation, update.path), update)
			, true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${hostNullCompleteStaticRepairImplementation}:${update.path}`]);
			assert.equal(reverseHostNullCompleteStaticRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeHostNullCompleteStaticRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("complete HostNull static repair authenticates its controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullCompleteStaticRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const source = git(["show"
		, `${hostNullCompleteStaticRepairImplementation}:tests/helpers/host-null-complete-hosted-evidence.mjs`]);
	assert.ok(source.includes("\n\t\t\t});\n\t\tconst key"));
});

test("complete HostNull static repair rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = git(["show"
		, `${hostNullCompleteStaticRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseHostNullCompleteStaticRepairUpdate(current, forged));
});

test("complete HostNull static repair writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-complete-static-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-complete-static-repair-source-history-20261030\.json/u);
});
