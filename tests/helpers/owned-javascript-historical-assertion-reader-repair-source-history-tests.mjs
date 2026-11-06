/**
 * Authenticate the owned JavaScript historical-assertion reader repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertOwnedJavaScriptHistoricalAssertionReaderRepair
	, beforeOwnedJavaScriptHistoricalAssertionReaderRepairSource
	, ownedJavaScriptHistoricalAssertionReaderRepairBehavior
	, ownedJavaScriptHistoricalAssertionReaderRepairHistoryAdditions
	, ownedJavaScriptHistoricalAssertionReaderRepairHistoryPath
	, ownedJavaScriptHistoricalAssertionReaderRepairImplementation
	, ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths
	, ownedJavaScriptHistoricalAssertionReaderRepairIntegrationPaths
	, ownedJavaScriptHistoricalAssertionReaderRepairNormalizationPaths
	, ownedJavaScriptHistoricalAssertionReaderRepairPredecessor
	, reverseOwnedJavaScriptHistoricalAssertionReaderRepairUpdate
} from "./owned-javascript-historical-assertion-reader-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	ownedJavaScriptHistoricalAssertionReaderRepairHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths.map(path => [
		path
		, blob(ownedJavaScriptHistoricalAssertionReaderRepairImplementation
			, path)
	])
);

test("historical assertion reader repair records the one-pass failure"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "owned-javascript-historical-assertion-reader-repair-v1");
		assert.equal(value.predecessorCommit
			, ownedJavaScriptHistoricalAssertionReaderRepairPredecessor);
		assert.equal(value.implementationCommit
			, ownedJavaScriptHistoricalAssertionReaderRepairImplementation);
		assert.equal(git(["rev-parse"
			, `${ownedJavaScriptHistoricalAssertionReaderRepairImplementation}^`])
			.trim(), ownedJavaScriptHistoricalAssertionReaderRepairPredecessor);
		assert.deepEqual(value.discovery, {
			profile: "checked-javascript-partition-11"
			, failingTest:
				"owned JavaScript checkout repair binds both exact producer shapes"
			, historicalProducer:
				"d3c7456ee19f16a716ed09232835057ce8762148"
		});
		assert.deepEqual(value.updates.map(update => update.path)
			, ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, ownedJavaScriptHistoricalAssertionReaderRepairIntegrationPaths);
	}
);

test("historical assertion reader uses the assertion accompanying its bytes"
	, () => {
		const sources = implementationSources();
		assert.deepEqual(assertOwnedJavaScriptHistoricalAssertionReaderRepair(
			sources), ownedJavaScriptHistoricalAssertionReaderRepairBehavior);
		const helper
			= "tests/helpers/owned-javascript-checkout-contract-repair-source-history.mjs";
		const tests
			= "tests/helpers/owned-javascript-checkout-contract-repair-source-history-tests.mjs";
		for(const [path, before, after] of [
			[helper, "assertHistoricalOwnedJavaScriptWasmCi(recurring)"
				, "assertOwnedJavaScriptWasmCi(recurring)"]
			, [tests, "timeout-minutes: 89", "timeout-minutes: 90"]
		]) {
			const changed = { ...sources
				, [path]: sources[path].replace(before, after) };
			assert.notEqual(changed[path], sources[path], path);
			assert.throws(() =>
				assertOwnedJavaScriptHistoricalAssertionReaderRepair(changed)
			, { name: "AssertionError" }, path);
		}
	}
);

test("historical assertion reader repair reverses both authenticated layers"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(
				ownedJavaScriptHistoricalAssertionReaderRepairImplementation
				, update.path);
			const previous = blob(
				ownedJavaScriptHistoricalAssertionReaderRepairPredecessor
				, update.path);
			assert.equal(
				reverseOwnedJavaScriptHistoricalAssertionReaderRepairUpdate(
					current, update), previous, update.path);
			assert.equal(
				beforeOwnedJavaScriptHistoricalAssertionReaderRepairSource(
					update.path, current, update.previousSha256)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256)
				, previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				ownedJavaScriptHistoricalAssertionReaderRepairHistoryPath
				, update.path, update.currentSha256);
			const previous = await sourceAtFinHistoryRecordSource(
				value.integrationPredecessorHistory
				, update.path, update.previousSha256);
			assert.equal(
				reverseOwnedJavaScriptHistoricalAssertionReaderRepairUpdate(
					current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256)
				, previous, update.path);
		}
		for(const path of
			ownedJavaScriptHistoricalAssertionReaderRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("historical assertion reader repair rejects forgeries and duplicate writers"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, ownedJavaScriptHistoricalAssertionReaderRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates[0];
		const current = blob(
			ownedJavaScriptHistoricalAssertionReaderRepairImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseOwnedJavaScriptHistoricalAssertionReaderRepairUpdate(
				current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-owned-javascript-historical-assertion-reader-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|implementation revision|History already exists/u);
	}
);
