/**
 * Authenticate isolation of historical pin assertions from live checkout bytes.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforeHistoricalPinSnapshotIsolationSource
	, historicalPinSnapshotIsolationHistoryAdditions
	, historicalPinSnapshotIsolationHistoryPath
	, historicalPinSnapshotIsolationImplementation
	, historicalPinSnapshotIsolationImplementationPaths
	, historicalPinSnapshotIsolationIntegrationPaths
	, historicalPinSnapshotIsolationPredecessor
	, reverseHistoricalPinSnapshotIsolationUpdate
} from "./historical-pin-snapshot-isolation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	historicalPinSnapshotIsolationHistoryPath, "utf8"));

test("historical pin isolation records its exact six-test repair", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "historical-pin-snapshot-isolation-v1");
	assert.equal(value.predecessorCommit
		, historicalPinSnapshotIsolationPredecessor);
	assert.equal(value.implementationCommit
		, historicalPinSnapshotIsolationImplementation);
	assert.deepEqual(value.updates.map(item => item.path)
		, historicalPinSnapshotIsolationImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, historicalPinSnapshotIsolationIntegrationPaths);
	assert.deepEqual(git(["diff", "--name-only"
		, historicalPinSnapshotIsolationPredecessor
		, historicalPinSnapshotIsolationImplementation]).trim().split("\n").sort()
		, [...historicalPinSnapshotIsolationImplementationPaths].sort());
});

test("historical pin assertions bind milestone bytes instead of live files"
	, async () => {
		const sources = new Map(historicalPinSnapshotIsolationImplementationPaths
			.map(path => [path
				, git(["show"
					, `${historicalPinSnapshotIsolationImplementation}:${path}`])]));
		for(const path of [
			"tests/helpers/scalar-fin-suite-registration-source-history-tests.mjs"
			, "tests/helpers/reviewed-specialization-sparse-suite-repair-source-history-tests.mjs"
			, "tests/helpers/consumer-suite-contract-repair-source-history-tests.mjs"
		]) {
			assert.doesNotMatch(sources.get(path)
				, /readFile\("docs\/type-surface\.v1\.json"/u, path);
			assert.match(sources.get(path)
				, /sourceAtFinHistoryRecordSource\(/u, path);
		}
		for(const path of [
			"tests/helpers/final-audit-checkout-optimization-source-history-tests.mjs"
			, "tests/helpers/performance-checkout-filter-source-history-tests.mjs"
		]) {
			assert.match(sources.get(path), /withHistoricalSources/u, path);
			assert.match(sources.get(path), /repository\s*, paths:/u, path);
		}
		const core = sources.get(
			"tests/helpers/core-historical-evidence-replay-source-history-tests.mjs");
		assert.doesNotMatch(core
			, /readFile\("docs\/type-surface\.v1\.json"/u);
		assert.ok(core.includes(
			"${coreHistoricalEvidenceReuseLivePinRepairImplementation}:docs/type-surface.v1.json"));
	}
);

test("historical pin isolation reverses every source transition", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${historicalPinSnapshotIsolationImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${historicalPinSnapshotIsolationPredecessor}:${update.path}`]);
		assert.equal(reverseHistoricalPinSnapshotIsolationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeHistoricalPinSnapshotIsolationSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			historicalPinSnapshotIsolationHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${historicalPinSnapshotIsolationImplementation}:${update.path}`]);
		assert.equal(reverseHistoricalPinSnapshotIsolationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("historical pin isolation authenticates additions and unchanged model"
	, async () => {
		const value = await record();
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(value.changedSupportCells, 0);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, historicalPinSnapshotIsolationHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${historicalPinSnapshotIsolationImplementation}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of historicalPinSnapshotIsolationIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const exactSources = [historicalPinSnapshotIsolationPredecessor
			, historicalPinSnapshotIsolationImplementation].map(commit =>
			git(["show", `${commit}:${exactModelPath}`]));
		assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
		const forged = value.updates[0];
		assert.throws(() => reverseHistoricalPinSnapshotIsolationUpdate(
			git(["show"
				, `${historicalPinSnapshotIsolationImplementation}:${forged.path}`])
			, { ...forged, currentSha256: "0".repeat(64) }));
	}
);
