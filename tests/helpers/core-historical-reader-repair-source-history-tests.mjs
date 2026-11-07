/**
 * Authenticate the historical-reader and dependent-Fin repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertCoreHistoricalReaderRepair
	, beforeCoreHistoricalReaderRepairSource
	, coreHistoricalReaderRepairBehavior
	, coreHistoricalReaderRepairHistoryAdditions
	, coreHistoricalReaderRepairHistoryPath
	, coreHistoricalReaderRepairImplementation
	, coreHistoricalReaderRepairImplementationAdditions
	, coreHistoricalReaderRepairIntegrationPaths
	, coreHistoricalReaderRepairModifiedPaths
	, coreHistoricalReaderRepairNormalizationPaths
	, coreHistoricalReaderRepairPredecessor
	, reverseCoreHistoricalReaderRepairUpdate
} from "./core-historical-reader-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	coreHistoricalReaderRepairHistoryPath, "utf8"));

test("historical-reader repair records its exact discovery and behavior", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-historical-reader-repair-source-v1");
	assert.equal(value.predecessorCommit
		, coreHistoricalReaderRepairPredecessor);
	assert.equal(value.implementationCommit
		, coreHistoricalReaderRepairImplementation);
	assert.equal(git(["rev-parse"
		, `${coreHistoricalReaderRepairImplementation}^`]).trim()
	, coreHistoricalReaderRepairPredecessor);
	assert.deepEqual(value.discovery, {
		candidate: "d6a4044154d4e998d31b7ad24ad245d5e5b93347"
		, coreRun: 42344725453
		, coreJobs: [128325268411, 128325268447, 128325268452]
		, downstreamRun: 42344727501, downstreamJob: 128323853791
	});
	assert.deepEqual(value.behavior, { ...coreHistoricalReaderRepairBehavior });
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 1);
	assert.deepEqual(value.updates.map(update => update.path)
		, coreHistoricalReaderRepairModifiedPaths);
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, coreHistoricalReaderRepairImplementationAdditions);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, coreHistoricalReaderRepairIntegrationPaths);
});

test("historical-reader repair binds its substantive implementation", () => {
	const paths = [
		...coreHistoricalReaderRepairModifiedPaths
		, ...coreHistoricalReaderRepairImplementationAdditions
	];
	const sources = Object.fromEntries(paths.map(path =>
		[path, blob(coreHistoricalReaderRepairImplementation, path)]));
	assert.deepEqual(assertCoreHistoricalReaderRepair(sources)
		, { ...coreHistoricalReaderRepairBehavior });
	assert.throws(() => assertCoreHistoricalReaderRepair({
		...sources
		, "src/build/component-scalar-adapters.mjs": blob(
			coreHistoricalReaderRepairPredecessor
			, "src/build/component-scalar-adapters.mjs")
	}), { name: "AssertionError" });
});

test("historical-reader repair reverses implementation and integration", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const current = blob(coreHistoricalReaderRepairImplementation, update.path);
		const previous = blob(coreHistoricalReaderRepairPredecessor, update.path);
		assert.equal(reverseCoreHistoricalReaderRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(coreHistoricalReaderRepairImplementation, update.path);
		assert.equal(beforeCoreHistoricalReaderRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of coreHistoricalReaderRepairNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("historical-reader repair refreshes exactly its live pins", async () => {
	const value = await record();
	assert.equal(value.currentSourcePins.length
		, coreHistoricalReaderRepairBehavior.currentSourcePaths);
	assert.equal(value.currentSourcePins.reduce(
		(sum, pin) => sum + pin.count, 0)
	, coreHistoricalReaderRepairBehavior.refreshedPins);
	const before = JSON.parse(blob(
		coreHistoricalReaderRepairImplementation, "docs/type-surface.v1.json"));
	const after = JSON.parse(await sourceAtFinHistoryMilestone(
		"docs/type-surface.v1.json", value.inventorySha256.after));
	let refreshed = 0;
	for(const evidence of before.evidence)
		for(const file of evidence.files)
		{
			const pin = value.currentSourcePins.find(item => item.path === file.path);
			if(pin === undefined) continue;
			assert.equal(file.sha256, pin.previous, file.path);
			file.sha256 = pin.current;
			refreshed++;
		}
	assert.equal(refreshed, coreHistoricalReaderRepairBehavior.refreshedPins);
	assert.deepEqual(before, after);
});

test("historical-reader repair authenticates additions and rejects forgeries", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, coreHistoricalReaderRepairHistoryAdditions);
	for(const addition of [
		...value.implementationAdditions, ...value.historyAdditions
	]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
		addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = value.updates[0];
	const current = blob(coreHistoricalReaderRepairImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCoreHistoricalReaderRepairUpdate(
		current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-core-historical-reader-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /History already exists|Expected values to be strictly equal/u);
});
