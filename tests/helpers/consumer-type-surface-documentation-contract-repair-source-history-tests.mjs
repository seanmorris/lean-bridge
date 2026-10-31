/**
 * Authenticate the reviewed-corpus documentation contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertReviewedCorpusReceiptContract
	, beforeConsumerTypeSurfaceDocumentationContractRepairSource
	, consumerTypeSurfaceDocumentationContractRepairHistoryAdditions
	, consumerTypeSurfaceDocumentationContractRepairHistoryPath
	, consumerTypeSurfaceDocumentationContractRepairImplementation
	, consumerTypeSurfaceDocumentationContractRepairImplementationPaths
	, consumerTypeSurfaceDocumentationContractRepairIntegrationPaths
	, consumerTypeSurfaceDocumentationContractRepairPredecessor
	, reverseConsumerTypeSurfaceDocumentationContractRepairUpdate
} from "./consumer-type-surface-documentation-contract-repair-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerTypeSurfaceDocumentationContractRepairHistoryPath, "utf8"));
const reviewedJobAt = commit => {
	const workflow = git(["show"
		, commit + ":.github/workflows/consumer-matrix.yml"]);
	return workflow.split("  reviewed-ir-admission:\n")[1]
		.split("  nix-cache:\n")[0];
};

test("reviewed-corpus contract repair records the exact hosted failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-type-surface-documentation-contract-repair-v1");
		assert.equal(history.predecessorCommit
			, consumerTypeSurfaceDocumentationContractRepairPredecessor);
		assert.equal(history.implementationCommit
			, consumerTypeSurfaceDocumentationContractRepairImplementation);
		assert.deepEqual(history.failedRun, {
			workflow: 41222778612
			, headSha: consumerTypeSurfaceDocumentationContractRepairPredecessor
		});
		assert.deepEqual(history.failure, {
			job: 124600962626, name: "Documentation contract"
			, completedAt: "2026-10-31T17:26:23Z"
			, test:
				"consumer CI history preserves every consumer and pinned build path"
			, staleExpectation:
				"The reviewed IR job must not use sparse checkout."
		});
		assert.equal(history.rootCause
			, "The reviewed IR job deliberately moved to the bounded sparse checkout and authenticated type-surface receipt, while its documentation contract still required the retired complete-checkout shape.");
	}
);

test("reviewed-corpus contract repair reverses every source", async () => {
	const history = await record();
	assert.deepEqual(history.updates.map(item => item.path)
		, consumerTypeSurfaceDocumentationContractRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, consumerTypeSurfaceDocumentationContractRepairIntegrationPaths);
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			consumerTypeSurfaceDocumentationContractRepairImplementation
			, update.path), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, consumerTypeSurfaceDocumentationContractRepairImplementation
				+ ":" + update.path]);
		assert.equal(
			reverseConsumerTypeSurfaceDocumentationContractRepairUpdate(
				current, update), previous, update.path);
		assert.equal(
			beforeConsumerTypeSurfaceDocumentationContractRepairSource(
				update.path, current, update.previousSha256)
			, previous, update.path);
	}
});

test("reviewed-corpus contract requires sparse receipt authentication", async () => {
	const history = await record();
	const job = reviewedJobAt(
		consumerTypeSurfaceDocumentationContractRepairImplementation);
	assertReviewedCorpusReceiptContract(job);
	assert.deepEqual(history.contract, {
		dependency: "type-surface-authentication"
		, checkoutDepth: 1, sparseCheckout: true, coneMode: false
		, receiptArtifact: "consumer-type-surface-${{ github.sha }}"
		, receiptPath: "build/consumer-type-surface/receipt.json"
		, receiptEnvironment: "LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT"
		, restoreBeforeBind: true, bindBeforeExecution: true
	});
	for(const malformed of [
		job.replace("needs: type-surface-authentication", "needs: other")
		, job.replace("fetch-depth: 1", "fetch-depth: 0")
		, job.replace("sparse-checkout: ${{ env.LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT }}"
			, "sparse-checkout: missing")
		, job.replace("Restore the authenticated type-surface receipt"
			, "Restore an unauthenticated corpus")
		, job.replace("LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT"
			, "LEAN_BRIDGE_MISSING_RECEIPT")
	]) assert.throws(() => assertReviewedCorpusReceiptContract(malformed));
});

test("reviewed-corpus contract repair refreshes exactly 25 live citations"
	, async () => {
		const history = await record();
		assert.equal(history.liveFiles, 2661);
		assert.equal(history.refreshedPins, 25);
		assert.equal(history.remainingMismatches, 0);
		assert.equal(history.missingLiveFiles, 0);
		assert.deepEqual(history.currentSourcePin, {
			path: "tests/documentation.test.mjs", count: 25
			, previous:
				"38f5c3a97a230c3865d7c16124bbc2a55c1f0eda3ca2ff44a34417cf7bf5b8d6"
			, current:
				"9d558637d133b355f831772df6e72e1fd0e9274c13608ae1b1851b69e8345a1d"
		});
		let restored = await readFile("docs/type-surface.v1.json", "utf8");
		assert.equal(restored.split(history.currentSourcePin.current).length - 1
			, 25);
		restored = restored.replaceAll(history.currentSourcePin.current
			, history.currentSourcePin.previous);
		assert.equal(restored, git(["show"
			, consumerTypeSurfaceDocumentationContractRepairImplementation
				+ ":docs/type-surface.v1.json"]));
	}
);

test("reviewed-corpus contract repair preserves the frozen #1220 model"
	, async () => {
		const history = await record();
		assert.deepEqual(history.exactModel, {
			sha256:
				"1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("reviewed-corpus contract repair authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerTypeSurfaceDocumentationContractRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerTypeSurfaceDocumentationContractRepairImplementation
				+ ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerTypeSurfaceDocumentationContractRepairUpdate(
				current, forged));
	}
);

test("reviewed-corpus contract repair writer refuses another record", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-type-surface-documentation-contract-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-type-surface-documentation-contract-repair-source-history-20261031[.]json/u);
});
