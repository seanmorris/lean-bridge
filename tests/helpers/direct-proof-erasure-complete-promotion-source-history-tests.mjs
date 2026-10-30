/**
 * Authenticate the complete direct proof-erasure publication lineage.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDirectProofErasureCompletePromotionSource
	, directProofErasureCompletePromotionChangedPaths
	, directProofErasureCompletePromotionCommits
	, directProofErasureCompletePromotionHistoryAdditions
	, directProofErasureCompletePromotionHistoryPath
	, directProofErasureCompletePromotionImplementation
	, directProofErasureCompletePromotionIntegrationPaths
	, directProofErasureCompletePromotionPredecessor
	, reverseDirectProofErasureCompletePromotionUpdate
} from "./direct-proof-erasure-complete-promotion-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureCompletePromotionHistoryPath, "utf8"));

test("complete proof-erasure publication records its exact transaction"
	, async () => {
		const history = await record();
		assert.deepEqual(Object.keys(history).sort(), [
			"cells", "historyAdditions", "implementationCommit"
			, "implementationCommits", "integrationUpdates", "milestone"
			, "outputs", "predecessorCommit", "schemaVersion", "scope"
			, "updates"
		].sort());
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "direct-proof-erasure-complete-promotion-source-v1");
		assert.equal(history.predecessorCommit
			, directProofErasureCompletePromotionPredecessor);
		assert.equal(history.implementationCommit
			, directProofErasureCompletePromotionImplementation);
		assert.deepEqual(history.implementationCommits
			, directProofErasureCompletePromotionCommits);
		assert.deepEqual(history.updates.map(item => item.path)
			, directProofErasureCompletePromotionChangedPaths);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, directProofErasureCompletePromotionIntegrationPaths);
		assert.equal(history.cells, 204);
		assert.equal(history.outputs, 16);
	}
);

test("complete proof-erasure publication reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureCompletePromotionImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureCompletePromotionImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureCompletePromotionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureCompletePromotionSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("complete proof-erasure publication authenticates controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureCompletePromotionHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${directProofErasureCompletePromotionPredecessor}..${directProofErasureCompletePromotionImplementation}`])
		.trim().split("\n"), directProofErasureCompletePromotionCommits);
});

test("complete proof-erasure publication rejects forged transitions"
	, async () => {
		const update = (await record()).updates.find(item =>
			item.path !== "docs/type-surface.v1.json");
		const current = git(["show"
			, `${directProofErasureCompletePromotionImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseDirectProofErasureCompletePromotionUpdate(current, forged));
	}
);

test("complete proof-erasure publication writer refuses another run", () => {
	const result = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-complete-promotion-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(result.status, 0);
	assert.match(`${result.stdout}${result.stderr}`
		, /direct-proof-erasure-complete-promotion-source-history-20261030\.json/u);
});
