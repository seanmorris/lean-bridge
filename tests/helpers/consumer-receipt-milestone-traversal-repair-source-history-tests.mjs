/**
 * Authenticate the exact consumer-receipt milestone traversal repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertConsumerReceiptMilestoneTraversalRepair
	, beforeConsumerReceiptMilestoneTraversalRepairSource
	, consumerReceiptMilestoneTraversalRepairHistoryAdditions
	, consumerReceiptMilestoneTraversalRepairHistoryPath
	, consumerReceiptMilestoneTraversalRepairImplementation
	, consumerReceiptMilestoneTraversalRepairImplementationPaths
	, consumerReceiptMilestoneTraversalRepairIntegrationPaths
	, consumerReceiptMilestoneTraversalRepairPredecessor
	, reverseConsumerReceiptMilestoneTraversalRepairUpdate
} from "./consumer-receipt-milestone-traversal-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerReceiptMilestoneTraversalRepairHistoryPath, "utf8"));

test("consumer receipt traversal repair records the complete local failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-receipt-milestone-traversal-repair-source-v1");
		assert.equal(history.predecessorCommit
			, consumerReceiptMilestoneTraversalRepairPredecessor);
		assert.equal(history.implementationCommit
			, consumerReceiptMilestoneTraversalRepairImplementation);
		assert.deepEqual(history.failure, {
			tests: 99, passed: 98, failed: 1
			, test: "downstream receipt repair refreshes exactly 96 live citations"
			, path: ".github/workflows/consumer-matrix.yml"
			, expectedPins: 92, observedPins: 0
		});
		assert.deepEqual(history.updates.map(item => item.path)
			, consumerReceiptMilestoneTraversalRepairImplementationPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, consumerReceiptMilestoneTraversalRepairIntegrationPaths);
	}
);

test("consumer receipt traversal repair targets the authenticated milestone"
	, () => {
		const source = git(["show"
			, consumerReceiptMilestoneTraversalRepairImplementation + ":"
			+ consumerReceiptMilestoneTraversalRepairImplementationPaths[0]]);
		assert.deepEqual(assertConsumerReceiptMilestoneTraversalRepair(source)
			, { exactDigestTraversal: true, restoredPins: 96 });
	}
);

test("consumer receipt traversal repair reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				consumerReceiptMilestoneTraversalRepairImplementation, update.path)
			, update), true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, consumerReceiptMilestoneTraversalRepairImplementation
					+ ":" + update.path]);
			assert.equal(reverseConsumerReceiptMilestoneTraversalRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeConsumerReceiptMilestoneTraversalRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...consumerReceiptMilestoneTraversalRepairImplementationPaths
			, ...consumerReceiptMilestoneTraversalRepairIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("consumer receipt traversal repair preserves the frozen model"
	, async () => {
		const history = await record();
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.semanticChanges, 0);
	}
);

test("consumer receipt traversal repair rejects forgeries and another writer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerReceiptMilestoneTraversalRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerReceiptMilestoneTraversalRepairImplementation
				+ ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerReceiptMilestoneTraversalRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-consumer-receipt-milestone-traversal-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|implementation revision/u);
	}
);
