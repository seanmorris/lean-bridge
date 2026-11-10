/**
 * Verify Node consumer timeout headroom and its reversible source seal.
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
	assertVo1220NodeConsumerTimeoutHeadroom
	, beforeVo1220NodeConsumerTimeoutHeadroomSource
	, reverseVo1220NodeConsumerTimeoutHeadroomUpdate
	, vo1220NodeConsumerTimeoutHeadroomBehavior
	, vo1220NodeConsumerTimeoutHeadroomCommits
	, vo1220NodeConsumerTimeoutHeadroomHistoryAdditions
	, vo1220NodeConsumerTimeoutHeadroomHistoryPath
	, vo1220NodeConsumerTimeoutHeadroomImplementation
	, vo1220NodeConsumerTimeoutHeadroomImplementationPaths
	, vo1220NodeConsumerTimeoutHeadroomIntegrationPaths
	, vo1220NodeConsumerTimeoutHeadroomPredecessor
} from "./vo1220-node-consumer-timeout-headroom-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const history = async () => JSON.parse(await readFile(
	vo1220NodeConsumerTimeoutHeadroomHistoryPath, "utf8"));

test("Node consumer timeout headroom records one exact implementation boundary"
	, async () => {
		const value = await history();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "vo1220-node-consumer-timeout-headroom-source-v1");
		assert.equal(value.predecessorCommit
			, vo1220NodeConsumerTimeoutHeadroomPredecessor);
		assert.equal(value.implementationCommit
			, vo1220NodeConsumerTimeoutHeadroomImplementation);
		assert.deepEqual(value.implementationCommits
			, vo1220NodeConsumerTimeoutHeadroomCommits);
		assert.deepEqual(value.updates.map(item => item.path)
			, vo1220NodeConsumerTimeoutHeadroomImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, vo1220NodeConsumerTimeoutHeadroomIntegrationPaths);
		assert.deepEqual(value.behavior
			, vo1220NodeConsumerTimeoutHeadroomBehavior);
	}
);

test("Node consumer timeout headroom reverses every authenticated source"
	, async () => {
		const value = await history();
		for(const update of value.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				vo1220NodeConsumerTimeoutHeadroomImplementation, update.path), update)
				, true, update.path);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(
				vo1220NodeConsumerTimeoutHeadroomImplementation, update.path);
			assert.equal(reverseVo1220NodeConsumerTimeoutHeadroomUpdate(
				current, update), previous, update.path);
			assert.equal(beforeVo1220NodeConsumerTimeoutHeadroomSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("Node consumer timeout headroom changes only its bound and live pins", () => {
	const currentSources = Object.fromEntries(
		vo1220NodeConsumerTimeoutHeadroomImplementationPaths.map(path => [
			path, blob(vo1220NodeConsumerTimeoutHeadroomImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220NodeConsumerTimeoutHeadroom(currentSources)
		, vo1220NodeConsumerTimeoutHeadroomBehavior);
	const previous = JSON.parse(blob(vo1220NodeConsumerTimeoutHeadroomPredecessor
		, "docs/type-surface.v1.json"));
	const current = JSON.parse(currentSources["docs/type-surface.v1.json"]);
	let pins = 0;
	for(const evidence of current.evidence)
		for(const file of evidence.files)
			if(file.path === ".github/workflows/consumer-matrix.yml")
			{
				file.sha256 = "b659de64e69d2b99a5472e902a80ffdd2f09f64c23288ec435910c6bcb3f58dd";
				pins += 1;
			}
	assert.equal(pins, 92);
	assert.deepEqual(current, previous);
});

test("Node consumer timeout headroom authenticates additions and forgeries"
	, async () => {
		const value = await history();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, vo1220NodeConsumerTimeoutHeadroomHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates.find(item => item.edits.length > 0);
		const current = blob(
			vo1220NodeConsumerTimeoutHeadroomImplementation, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseVo1220NodeConsumerTimeoutHeadroomUpdate(current, forged));
		const writer = spawnSync(process.execPath, [
			"scripts/update-vo1220-node-consumer-timeout-headroom-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(writer.status, 0);
		assert.match(`${writer.stdout}${writer.stderr}`
			, /already exists|implementation/u);
	}
);
