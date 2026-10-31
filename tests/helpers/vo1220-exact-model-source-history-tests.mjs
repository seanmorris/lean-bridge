/**
 * Authenticate the complete VO #1220 exact-model audit.
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
	beforeVo1220ExactModelSource
	, reverseVo1220ExactModelUpdate
	, vo1220ExactModelHistoryAdditions
	, vo1220ExactModelHistoryPath
	, vo1220ExactModelImplementation
	, vo1220ExactModelImplementationAdditions
	, vo1220ExactModelImplementationPaths
	, vo1220ExactModelIntegrationPaths
	, vo1220ExactModelPredecessor
} from "./vo1220-exact-model-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	vo1220ExactModelHistoryPath, "utf8"));

test("#1220 exact-model history records the complete matrix", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-exact-model-source-v1");
	assert.equal(history.predecessorCommit, vo1220ExactModelPredecessor);
	assert.equal(history.implementationCommit, vo1220ExactModelImplementation);
	assert.deepEqual([
		history.owner, history.cells, history.stageEntries
		, history.passedStageEntries, history.reportedMutationMismatches
	], [1220, 1054, 5270, 5270, 4]);
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220ExactModelImplementationPaths);
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, vo1220ExactModelImplementationAdditions);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220ExactModelIntegrationPaths);
});

test("#1220 exact-model history reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			vo1220ExactModelImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, vo1220ExactModelImplementation + ":" + update.path]);
		assert.equal(reverseVo1220ExactModelUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220ExactModelSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("#1220 exact-model history authenticates the frozen model", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
	{
		const source = git(["show"
			, vo1220ExactModelImplementation + ":" + addition.path]);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
	const model = JSON.parse(await readFile(
		"docs/evidence/vo1220-exact-type-surface-v1.json", "utf8"));
	assert.equal(model.model.length, 1054);
	assert.equal(model.stageEntries, 5270);
	assert.equal(model.model.flatMap(cell =>
		Object.values(cell.stages)).filter(stage =>
		stage.state === "passed").length, 5270);
	assert.equal(history.exactModel.sha256
		, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
	assert.equal(history.exactModel.bytes, 16916757);
});

test("#1220 exact-model history authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, vo1220ExactModelHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, vo1220ExactModelImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() => reverseVo1220ExactModelUpdate(current, forged));
	}
);

test("#1220 exact-model history writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-vo1220-exact-model-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /vo1220-exact-model-source-history-20261031\.json/u);
});
