/**
 * Verify live timeout-pin completion and its reversible source seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220NodeConsumerTimeoutPinCompletion
	, beforeVo1220NodeConsumerTimeoutPinCompletionSource
	, reverseVo1220NodeConsumerTimeoutPinCompletionUpdate
	, vo1220NodeConsumerTimeoutPinCompletionBehavior
	, vo1220NodeConsumerTimeoutPinCompletionCommits
	, vo1220NodeConsumerTimeoutPinCompletionCurrentSha256
	, vo1220NodeConsumerTimeoutPinCompletionHistoryAdditions
	, vo1220NodeConsumerTimeoutPinCompletionHistoryPath
	, vo1220NodeConsumerTimeoutPinCompletionImplementation
	, vo1220NodeConsumerTimeoutPinCompletionImplementationPaths
	, vo1220NodeConsumerTimeoutPinCompletionIntegrationPaths
	, vo1220NodeConsumerTimeoutPinCompletionPredecessor
	, vo1220NodeConsumerTimeoutPinCompletionPreviousSha256
} from "./vo1220-node-consumer-timeout-pin-completion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const history = async () => JSON.parse(await readFile(
	vo1220NodeConsumerTimeoutPinCompletionHistoryPath, "utf8"));

test("Node consumer timeout pin completion records one exact boundary"
	, async () => {
		const value = await history();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "vo1220-node-consumer-timeout-pin-completion-source-v1");
		assert.equal(value.predecessorCommit
			, vo1220NodeConsumerTimeoutPinCompletionPredecessor);
		assert.equal(value.implementationCommit
			, vo1220NodeConsumerTimeoutPinCompletionImplementation);
		assert.deepEqual(value.implementationCommits
			, vo1220NodeConsumerTimeoutPinCompletionCommits);
		assert.deepEqual(value.updates.map(item => item.path)
			, vo1220NodeConsumerTimeoutPinCompletionImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, vo1220NodeConsumerTimeoutPinCompletionIntegrationPaths);
		assert.deepEqual(value.behavior
			, vo1220NodeConsumerTimeoutPinCompletionBehavior);
	}
);

test("Node consumer timeout pin completion reverses every source"
	, async () => {
		const value = await history();
		for(const update of value.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				vo1220NodeConsumerTimeoutPinCompletionImplementation, update.path)
				, update), true, update.path);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(
				vo1220NodeConsumerTimeoutPinCompletionImplementation, update.path);
			assert.equal(reverseVo1220NodeConsumerTimeoutPinCompletionUpdate(
				current, update), previous, update.path);
			assert.equal(beforeVo1220NodeConsumerTimeoutPinCompletionSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("Node consumer timeout pin completion changes only 25 live pins", () => {
	const source = blob(vo1220NodeConsumerTimeoutPinCompletionImplementation
		, "docs/type-surface.v1.json");
	assert.deepEqual(assertVo1220NodeConsumerTimeoutPinCompletion({
		"docs/type-surface.v1.json": source
	}), vo1220NodeConsumerTimeoutPinCompletionBehavior);
	const previous = JSON.parse(blob(
		vo1220NodeConsumerTimeoutPinCompletionPredecessor
		, "docs/type-surface.v1.json"));
	const current = JSON.parse(source);
	let pins = 0;
	for(const evidence of current.evidence)
		for(const file of evidence.files)
			if(file.path === "tests/documentation.test.mjs")
			{
				assert.equal(file.sha256
					, vo1220NodeConsumerTimeoutPinCompletionCurrentSha256);
				file.sha256
					= vo1220NodeConsumerTimeoutPinCompletionPreviousSha256;
				pins++;
			}
	assert.equal(pins, 25);
	assert.deepEqual(current, previous);
});

test("Node consumer timeout pin completion authenticates additions and forgeries"
	, async () => {
		const value = await history();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, vo1220NodeConsumerTimeoutPinCompletionHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates.find(item => item.edits.length > 0);
		const current = blob(
			vo1220NodeConsumerTimeoutPinCompletionImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseVo1220NodeConsumerTimeoutPinCompletionUpdate(current, forged));
		const writer = spawnSync(process.execPath, [
			"scripts/update-vo1220-node-consumer-timeout-pin-completion-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(writer.status, 0);
		assert.match(`${writer.stdout}${writer.stderr}`
			, /already exists|implementation/u);
	}
);
