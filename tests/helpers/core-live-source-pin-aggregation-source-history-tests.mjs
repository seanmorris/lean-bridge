/**
 * Authenticate complete live-source pin aggregation and reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { typeSurfaceEvidenceFiles }
	from "../../src/adoption/type-surface-evidence-receipt.mjs";
import {
	beforeCoreLiveSourcePinAggregationSource
	, coreLiveSourcePinAggregationHistoryAdditions
	, coreLiveSourcePinAggregationHistoryPath
	, coreLiveSourcePinAggregationImplementation
	, coreLiveSourcePinAggregationImplementationPaths
	, coreLiveSourcePinAggregationIntegrationPaths
	, coreLiveSourcePinAggregationPredecessor
	, reverseCoreLiveSourcePinAggregationUpdate
} from "./core-live-source-pin-aggregation-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreLiveSourcePinAggregationHistoryPath, "utf8"));

test("live-source aggregation records the complete Core failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "core-live-source-pin-aggregation-source-v1");
	assert.equal(history.predecessorCommit
		, coreLiveSourcePinAggregationPredecessor);
	assert.equal(history.implementationCommit
		, coreLiveSourcePinAggregationImplementation);
	assert.deepEqual(history.failedRun, {
		workflow: 41177050728, job: 124470173666
	});
	assert.equal(history.liveFiles, 2661);
	assert.equal(history.stalePaths, 3);
	assert.equal(history.refreshedPins, 60);
	assert.equal(history.remainingMismatches, 0);
	assert.equal(history.missingLiveFiles, 0);
	assert.equal(history.aggregateFailures, true);
	assert.deepEqual(history.updates.map(item => item.path)
		, coreLiveSourcePinAggregationImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, coreLiveSourcePinAggregationIntegrationPaths);
});

test("live-source aggregation reverses every modified source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			coreLiveSourcePinAggregationImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, coreLiveSourcePinAggregationImplementation + ":" + update.path]);
		assert.equal(reverseCoreLiveSourcePinAggregationUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCoreLiveSourcePinAggregationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("all current live-source pins match in one complete pass", async () => {
	const document = JSON.parse(await readFile(
		"docs/type-surface.v1.json", "utf8"));
	const files = typeSurfaceEvidenceFiles(document).filter(file =>
		!file.path.startsWith("docs/evidence/"));
	const mismatches = [];
	const missing = [];
	for(let offset = 0; offset < files.length; offset += 16)
	{
		const batch = files.slice(offset, offset + 16);
		const actual = await Promise.all(batch.map(async file => {
			try
			{
				return createHash("sha256").update(
					await readFile(file.path)).digest("hex");
			}
			catch(error)
			{ missing.push({ path: file.path, code: error.code }); return null; }
		}));
		for(const [index, file] of batch.entries())
			if(actual[index] !== null && actual[index] !== file.sha256)
				mismatches.push({
					path: file.path, actual: actual[index], expected: file.sha256
				});
	}
	assert.equal(files.length, 2661);
	assert.deepEqual(missing, []);
	assert.deepEqual(mismatches, []);
});

test("live-source aggregation refreshes only the complete three-path set"
	, async () => {
		const history = await record();
		assert.deepEqual(history.currentSourcePins.map(item => item.path), [
			"src/adoption/type-surface.mjs"
			, "tests/type-surface-docs.test.mjs"
			, "tests/type-surface.test.mjs"
		]);
		assert.deepEqual(history.currentSourcePins.map(item => item.count)
			, [1, 24, 35]);
		let restored = git(["show"
			, coreLiveSourcePinAggregationImplementation
				+ ":docs/type-surface.v1.json"]);
		for(const pin of history.currentSourcePins)
		{
			assert.equal(restored.split(pin.current).length - 1, pin.count);
			restored = restored.replaceAll(pin.current, pin.previous);
		}
		assert.equal(restored, git(["show"
			, coreLiveSourcePinAggregationPredecessor
				+ ":docs/type-surface.v1.json"]));
	}
);

test("live-source aggregation preserves the frozen #1220 exact model"
	, async () => {
		const history = await record();
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("live-source aggregation authenticates additions and rejects forgeries"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, coreLiveSourcePinAggregationHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, coreLiveSourcePinAggregationImplementation + ":" + update.path]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseCoreLiveSourcePinAggregationUpdate(current, forged));
	}
);

test("live-source aggregation writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-live-source-pin-aggregation-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /core-live-source-pin-aggregation-source-history-20261031\.json/u);
});
