/**
 * Authenticate the evidence-free Docker consumer source repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeConsumerDockerEvidenceExclusionSource
	, consumerDockerEvidenceExclusionHistoryAdditions
	, consumerDockerEvidenceExclusionHistoryPath
	, consumerDockerEvidenceExclusionImplementation
	, consumerDockerEvidenceExclusionImplementationPaths
	, consumerDockerEvidenceExclusionIntegrationPaths
	, consumerDockerEvidenceExclusionPredecessor
	, reverseConsumerDockerEvidenceExclusionUpdate
} from "./consumer-docker-evidence-exclusion-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerDockerEvidenceExclusionHistoryPath, "utf8"));

test("Docker evidence exclusion records the exact hosted failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "consumer-docker-evidence-exclusion-source-v1");
	assert.equal(history.predecessorCommit
		, consumerDockerEvidenceExclusionPredecessor);
	assert.equal(history.implementationCommit
		, consumerDockerEvidenceExclusionImplementation);
	assert.deepEqual(history.failedRun, {
		workflow: 41197560800, job: 124530096368
	});
	assert.deepEqual(history.failure, {
		step: "Execute the clean consumer through Docker"
		, completedAt: "2026-10-31T12:32:45Z"
		, error: "write of 24576 bytes: No space left on device"
		, runnerDiskBeforeCleanupGiB: 86
		, runnerDiskAfterCleanupGiB: 108
		, checkoutGitGiB: 25
		, runnerDiskAfterCheckoutGiB: 34
	});
	assert.deepEqual(history.trackedTree, {
		allBytes: 51999627829, allFiles: 228984
		, evidenceBytes: 51797463311, evidenceFiles: 217300
		, nonEvidenceBytes: 202164518, nonEvidenceFiles: 11684
	});
	assert.equal(history.semanticChanges, 0);
});

test("Docker evidence exclusion reverses every modified source", async () => {
	const history = await record();
	assert.deepEqual(history.updates.map(item => item.path)
		, consumerDockerEvidenceExclusionImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, consumerDockerEvidenceExclusionIntegrationPaths);
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			consumerDockerEvidenceExclusionImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, consumerDockerEvidenceExclusionImplementation + ":" + update.path]);
		assert.equal(reverseConsumerDockerEvidenceExclusionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeConsumerDockerEvidenceExclusionSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Docker evidence exclusion refreshes only 92 workflow pins", async () => {
	const history = await record();
	assert.equal(history.refreshedCitationCount, 92);
	assert.deepEqual(history.currentSourcePins.map(item => ({
		path: item.path, count: item.count
	})), [{
		path: ".github/workflows/consumer-matrix.yml", count: 92
	}]);
	let restored = git(["show"
		, consumerDockerEvidenceExclusionImplementation
			+ ":docs/type-surface.v1.json"]);
	for(const pin of history.currentSourcePins)
	{
		assert.equal(restored.split(pin.current).length - 1, pin.count);
		restored = restored.replaceAll(pin.current, pin.previous);
	}
	assert.equal(restored, git(["show"
		, consumerDockerEvidenceExclusionPredecessor
			+ ":docs/type-surface.v1.json"]));
});

test("Docker evidence exclusion records the bounded build source", async () => {
	const history = await record();
	assert.deepEqual(history.checkout, {
		fetchDepth: 1, sparse: true, coneMode: false
		, omitted: "docs/evidence", missingBlobFloor: 1000
		, gitKiBCeiling: 2097152, sourceKiBCeiling: 2097152
	});
	assert.equal(history.buildSource.mode, "sparse-path");
	assert.equal(history.buildSource.snapshotsPerAttempt, 1);
	assert.equal(history.buildSource.excluded, "docs/evidence");
	assert.deepEqual(history.buildSource.flakeOutputs
		, ["universal-core-artifacts", "npm-package"]);
	assert.equal(history.buildSource.consumer, "tests/consumer-node.test.mjs");
	assert.match(history.buildSource.revisionBoundary
		, /Publication and reproducibility gates separately require/u);
});

test("Docker evidence exclusion authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, consumerDockerEvidenceExclusionHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, consumerDockerEvidenceExclusionImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerDockerEvidenceExclusionUpdate(current, forged));
	}
);

test("Docker evidence exclusion writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-consumer-docker-evidence-exclusion-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /consumer-docker-evidence-exclusion-source-history-20261031\.json/u);
});
