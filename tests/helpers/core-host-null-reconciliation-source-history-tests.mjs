/**
 * Authenticate the final HostNull/Core reconciliation exposed by full shards.
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
	beforeCoreHostNullReconciliationSource
	, coreHostNullReconciliationHistoryAdditions
	, coreHostNullReconciliationHistoryPath
	, coreHostNullReconciliationImplementation
	, coreHostNullReconciliationImplementationPaths
	, coreHostNullReconciliationIntegrationPaths
	, coreHostNullReconciliationPinnedPaths
	, coreHostNullReconciliationPredecessor
	, coreHostNullReconciliationRefreshedPins
	, reverseCoreHostNullReconciliationUpdate
} from "./core-host-null-reconciliation-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreHostNullReconciliationHistoryPath, "utf8"));

test("HostNull/Core reconciliation records the exact full-shard failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-host-null-reconciliation-source-v1");
	assert.equal(history.predecessorCommit
		, coreHostNullReconciliationPredecessor);
	assert.equal(history.implementationCommit
		, coreHostNullReconciliationImplementation);
	assert.equal(history.failedRun, 41085548611);
	assert.deepEqual(history.affectedJobs, [
		124185638900, 124185638929, 124185639012
		, 124185639127, 124185639197
	]);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreHostNullReconciliationImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreHostNullReconciliationIntegrationPaths);
});

test("HostNull/Core reconciliation reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreHostNullReconciliationImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${coreHostNullReconciliationImplementation}:${update.path}`]);
		assert.equal(reverseCoreHostNullReconciliationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreHostNullReconciliationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("HostNull/Core reconciliation refreshes pins without changing claims", async () => {
	const history = await record();
	assert.equal(history.refreshedPins
		, coreHostNullReconciliationRefreshedPins);
	assert.equal(history.pinnedPaths, coreHostNullReconciliationPinnedPaths);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, coreHostNullReconciliationHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const path = "docs/type-surface.v1.json";
	const before = JSON.parse(git(["show"
		, `${coreHostNullReconciliationPredecessor}:${path}`]));
	const after = JSON.parse(git(["show"
		, `${coreHostNullReconciliationImplementation}:${path}`]));
	assert.deepEqual(Object.keys(after), Object.keys(before));
	let refreshed = 0;
	const changedPaths = new Set();
	for(const [index, entry] of before.evidence.entries())
	{
		const current = after.evidence[index];
		const { files: beforeFiles, ...beforeClaim } = entry;
		const { files: afterFiles, ...afterClaim } = current;
		assert.deepEqual(afterClaim, beforeClaim, entry.id);
		assert.equal(afterFiles.length, beforeFiles.length, entry.id);
		for(const [fileIndex, file] of beforeFiles.entries())
		{
			const currentFile = afterFiles[fileIndex];
			assert.equal(currentFile.path, file.path, entry.id);
			if(currentFile.sha256 !== file.sha256)
			{
				refreshed++;
				changedPaths.add(file.path);
			}
		}
	}
	assert.equal(refreshed, coreHostNullReconciliationRefreshedPins);
	assert.equal(changedPaths.size, coreHostNullReconciliationPinnedPaths);
	const { evidence: beforeEvidence, ...beforeContract } = before;
	const { evidence: afterEvidence, ...afterContract } = after;
	assert.ok(beforeEvidence && afterEvidence);
	assert.deepEqual(afterContract, beforeContract);
});

test("HostNull/Core reconciliation rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${coreHostNullReconciliationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.json" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseCoreHostNullReconciliationUpdate(current, forged));
});

test("HostNull/Core reconciliation writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-host-null-reconciliation-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /core-host-null-reconciliation-source-history-20261030\.json/u);
});
