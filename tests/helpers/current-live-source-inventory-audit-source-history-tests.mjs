/**
 * Authenticate the current live-source inventory audit repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCurrentLiveSourceInventoryAudit
	, beforeCurrentLiveSourceInventoryAuditSource
	, currentLiveSourceInventoryAuditHistoryAdditions
	, currentLiveSourceInventoryAuditHistoryPath
	, currentLiveSourceInventoryAuditImplementation
	, currentLiveSourceInventoryAuditImplementationPaths
	, currentLiveSourceInventoryAuditIntegrationPaths
	, currentLiveSourceInventoryAuditPredecessor
	, reverseCurrentLiveSourceInventoryAuditUpdate
} from "./current-live-source-inventory-audit-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	currentLiveSourceInventoryAuditHistoryPath, "utf8"));

test("current live-source audit records the stale expectation failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "current-live-source-inventory-audit-v1");
		assert.equal(history.predecessorCommit
			, currentLiveSourceInventoryAuditPredecessor);
		assert.equal(history.implementationCommit
			, currentLiveSourceInventoryAuditImplementation);
		assert.deepEqual(history.discovery, {
			gate: "all current live-source pins match in one complete pass"
			, partition: "tests/checked-javascript-partition-11.test.mjs"
			, path: ".github/workflows/consumer-matrix.yml"
			, actual: "7e842a6dd36ee897a3defaaa40546ed7079c37ac4b85511839a947818798badd"
			, staleExpected: "83d38737fa631ff9fbbd5b6079ca0b62a986bf703c8313df825043610ea098c2"
		});
	}
);

test("current live-source audit binds the complete current inventory"
	, async () => {
		const history = await record();
		const source = git(["show"
			, `${currentLiveSourceInventoryAuditImplementation}:${
				currentLiveSourceInventoryAuditImplementationPaths[0]}`]);
		assertCurrentLiveSourceInventoryAudit(source);
		assert.deepEqual(history.repair, {
			inventory: "docs/type-surface.v1.json"
			, selection: "current worktree"
			, liveFiles: 2661, missingFiles: 0, mismatches: 0
		});
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 0);
	}
);

test("current live-source audit reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, currentLiveSourceInventoryAuditImplementationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				currentLiveSourceInventoryAuditImplementation, update.path)
				, update), true, update.path);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, currentLiveSourceInventoryAuditIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${currentLiveSourceInventoryAuditImplementation}:${update.path}`]);
			assert.equal(reverseCurrentLiveSourceInventoryAuditUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCurrentLiveSourceInventoryAuditSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...currentLiveSourceInventoryAuditImplementationPaths
			, ...currentLiveSourceInventoryAuditIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("current live-source audit rejects forgeries and another writer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, currentLiveSourceInventoryAuditHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${currentLiveSourceInventoryAuditImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseCurrentLiveSourceInventoryAuditUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-current-live-source-inventory-audit-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
