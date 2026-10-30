/**
 * Authenticate the final live-only VO #1220 zero-gap assertion.
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
	beforeVo1220LiveZeroGapSource, reverseVo1220LiveZeroGapUpdate
	, vo1220LiveZeroGapHistoryAdditions, vo1220LiveZeroGapHistoryPath
	, vo1220LiveZeroGapImplementation, vo1220LiveZeroGapImplementationPaths
	, vo1220LiveZeroGapIntegrationPaths, vo1220LiveZeroGapPredecessor
} from "./vo1220-live-zero-gap-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	vo1220LiveZeroGapHistoryPath, "utf8"));

test("live #1220 zero-gap audit records the exact closure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "vo1220-live-zero-gap-source-v1");
	assert.equal(history.predecessorCommit, vo1220LiveZeroGapPredecessor);
	assert.equal(history.implementationCommit, vo1220LiveZeroGapImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, vo1220LiveZeroGapImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, vo1220LiveZeroGapIntegrationPaths);
	assert.deepEqual([
		history.owner, history.cells, history.stageEntries, history.passedCells
		, history.gapEntries, history.syntheticFallback
	], [1220, 1054, 5270, 1054, 0, false]);
});

test("live #1220 zero-gap audit reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			vo1220LiveZeroGapImplementation, update.path), update), true);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${vo1220LiveZeroGapImplementation}:${update.path}`]);
		assert.equal(reverseVo1220LiveZeroGapUpdate(current, update), previous);
		assert.equal(beforeVo1220LiveZeroGapSource(
			update.path, current, update.previousSha256), previous);
	}
});

test("live #1220 zero-gap audit authenticates its controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, vo1220LiveZeroGapHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const source = git(["show"
		, `${vo1220LiveZeroGapImplementation}:tests/helpers/vo1220-zero-gap-tests.mjs`]);
	assert.doesNotMatch(source, /promoteHostNullComplete/u);
	assert.doesNotMatch(source, /gaps\.length === 0 \?/u);
});

test("live #1220 zero-gap audit rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${vo1220LiveZeroGapImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseVo1220LiveZeroGapUpdate(current, forged));
});

test("live #1220 zero-gap writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-vo1220-live-zero-gap-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /vo1220-live-zero-gap-source-history-20261030\.json/u);
});
