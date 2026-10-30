/**
 * Authenticate the complete hosted HostNull publication lineage.
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
	beforeHostNullCompletePromotionSource
	, hostNullCompletePromotionHistoryAdditions
	, hostNullCompletePromotionHistoryPath
	, hostNullCompletePromotionImplementation
	, hostNullCompletePromotionImplementationAdditions
	, hostNullCompletePromotionImplementationPaths
	, hostNullCompletePromotionIntegrationPaths
	, hostNullCompletePromotionPredecessor
	, reverseHostNullCompletePromotionUpdate
} from "./host-null-complete-promotion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullCompletePromotionHistoryPath, "utf8"));

test("complete HostNull publication records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "host-null-complete-promotion-source-v1");
	assert.equal(history.predecessorCommit
		, hostNullCompletePromotionPredecessor);
	assert.equal(history.implementationCommit
		, hostNullCompletePromotionImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, hostNullCompletePromotionImplementationPaths);
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, hostNullCompletePromotionImplementationAdditions);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, hostNullCompletePromotionIntegrationPaths);
	assert.deepEqual([
		history.owner, history.cells, history.stageEntries, history.observations
		, history.captures, history.sourcePins, history.documentationPins
	], [1220, 170, 850, 24, 7, 131, 70]);
});

test("complete HostNull publication reverses every modified source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				hostNullCompletePromotionImplementation, update.path), update)
			, true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${hostNullCompletePromotionImplementation}:${update.path}`]);
			assert.equal(reverseHostNullCompletePromotionUpdate(
				current, update), previous, update.path);
			assert.equal(beforeHostNullCompletePromotionSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("complete HostNull publication authenticates every addition", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(sha256(git(["show"
			, `${hostNullCompletePromotionImplementation}:${addition.path}`]))
		, addition.sha256, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullCompletePromotionHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
});

test("complete HostNull publication rejects forged transitions", async () => {
	const update = (await record()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = git(["show"
		, `${hostNullCompletePromotionImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseHostNullCompletePromotionUpdate(current, forged));
});

test("complete HostNull publication writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-complete-promotion-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-complete-promotion-source-history-20261030\.json/u);
});
