/**
 * Authenticate the historical citation-transition audit repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertHistoricalCitationTransitionAudit
	, beforeHistoricalCitationTransitionAuditSource
	, historicalCitationTransitionAuditHistoryAdditions
	, historicalCitationTransitionAuditHistoryPath
	, historicalCitationTransitionAuditImplementation
	, historicalCitationTransitionAuditImplementationPaths
	, historicalCitationTransitionAuditIntegrationPaths
	, historicalCitationTransitionAuditPredecessor
	, reverseHistoricalCitationTransitionAuditUpdate
} from "./historical-citation-transition-audit-source-history.mjs";
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
	historicalCitationTransitionAuditHistoryPath, "utf8"));

test("historical citation audit records the complete stale assertion"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "historical-citation-transition-audit-v1");
		assert.equal(history.predecessorCommit
			, historicalCitationTransitionAuditPredecessor);
		assert.equal(history.implementationCommit
			, historicalCitationTransitionAuditImplementation);
		assert.deepEqual(history.discovery, {
			partition: "tests/checked-javascript-partition-11.test.mjs"
			, contract: "reviewed-corpus contract repair refreshes exactly 25 live citations"
			, expectedPins: 25, observedPinsAfterPartialNormalization: 0
		});
	}
);

test("historical citation audit binds the recorded transition"
	, async () => {
		const history = await record();
		const source = git(["show"
			, `${historicalCitationTransitionAuditImplementation}:${
				historicalCitationTransitionAuditImplementationPaths[0]}`]);
		assertHistoricalCitationTransitionAudit(source);
		assert.deepEqual(history.repair, {
			path: "docs/type-surface.v1.json", exactPins: 25
			, currentStateDelegatedTo: "current live-source inventory audit"
		});
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 0);
	}
);

test("historical citation audit reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, historicalCitationTransitionAuditImplementationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				historicalCitationTransitionAuditImplementation, update.path)
				, update), true, update.path);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, historicalCitationTransitionAuditIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${historicalCitationTransitionAuditImplementation}:${update.path}`]);
			assert.equal(reverseHistoricalCitationTransitionAuditUpdate(
				current, update), previous, update.path);
			assert.equal(beforeHistoricalCitationTransitionAuditSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...historicalCitationTransitionAuditImplementationPaths
			, ...historicalCitationTransitionAuditIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("historical citation audit rejects forgeries and another writer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, historicalCitationTransitionAuditHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${historicalCitationTransitionAuditImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseHistoricalCitationTransitionAuditUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-historical-citation-transition-audit-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
