/**
 * Authenticate the final owned-JavaScript CI budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertOwnedJavaScriptCiBudgetRepair
	, beforeOwnedJavaScriptCiBudgetRepairSource
	, ownedJavaScriptCiBudgetRepairBehavior
	, ownedJavaScriptCiBudgetRepairHistoryAdditions
	, ownedJavaScriptCiBudgetRepairHistoryPath
	, ownedJavaScriptCiBudgetRepairImplementation
	, ownedJavaScriptCiBudgetRepairImplementationPaths
	, ownedJavaScriptCiBudgetRepairIntegrationPaths
	, ownedJavaScriptCiBudgetRepairNormalizationPaths
	, ownedJavaScriptCiBudgetRepairPredecessor
	, reverseOwnedJavaScriptCiBudgetRepairUpdate
} from "./owned-javascript-ci-budget-repair-source-history.mjs";
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
	ownedJavaScriptCiBudgetRepairHistoryPath, "utf8"));
const implementationSources = () => Object.fromEntries(
	ownedJavaScriptCiBudgetRepairImplementationPaths.map(path => [
		path, blob(ownedJavaScriptCiBudgetRepairImplementation, path)
	])
);

test("owned JavaScript budget repair records the exact hosted timeout", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "owned-javascript-ci-budget-repair-v1");
	assert.equal(value.predecessorCommit
		, ownedJavaScriptCiBudgetRepairPredecessor);
	assert.equal(value.implementationCommit
		, ownedJavaScriptCiBudgetRepairImplementation);
	assert.equal(git(["rev-parse"
		, `${ownedJavaScriptCiBudgetRepairImplementation}^`]).trim()
		, ownedJavaScriptCiBudgetRepairPredecessor);
	assert.deepEqual(value.discovery, {
		run: 42248057427, job: 127998154414
		, candidate: ownedJavaScriptCiBudgetRepairPredecessor
		, event: "workflow_dispatch"
		, startedAt: "2026-11-06T16:03:55Z"
		, cancelledAt: "2026-11-06T17:34:08Z"
		, terminalStep: "Verify owned JavaScript engine and archive SDK contracts"
	});
	assert.deepEqual(value.behavior, {
		...ownedJavaScriptCiBudgetRepairBehavior
		, livePinRefreshes: {
			...ownedJavaScriptCiBudgetRepairBehavior.livePinRefreshes
		}
	});
	assert.deepEqual(value.updates.map(update => update.path)
		, ownedJavaScriptCiBudgetRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, ownedJavaScriptCiBudgetRepairIntegrationPaths);
});

test("owned JavaScript budget repair binds the complete lane and mutation", () => {
	const sources = implementationSources();
	assert.deepEqual(assertOwnedJavaScriptCiBudgetRepair(sources), {
		...ownedJavaScriptCiBudgetRepairBehavior
		, livePinRefreshes: {
			...ownedJavaScriptCiBudgetRepairBehavior.livePinRefreshes
		}
	});
	for(const [path, before, after] of [
		[".github/workflows/consumer-matrix.yml"
			, "    timeout-minutes: 150\n", "    timeout-minutes: 90\n"]
		, ["tests/helpers/owned-javascript-wasm-ci.mjs"
			, "assert.match(job, /^ {4}timeout-minutes: 150$/mu);"
			, "assert.match(job, /^ {4}timeout-minutes: 90$/mu);"]
		, ["tests/owned-javascript-wasm-ci.test.mjs"
			, '["    timeout-minutes: 150\\n", "    timeout-minutes: 90\\n"]'
			, '["    timeout-minutes: 150\\n", "    timeout-minutes: 149\\n"]']
	]) {
		const changed = { ...sources
			, [path]: sources[path].replace(before, after) };
		assert.notEqual(changed[path], sources[path], path);
		assert.throws(() => assertOwnedJavaScriptCiBudgetRepair(changed)
			, { name: "AssertionError" }, path);
	}
});

test("owned JavaScript budget repair reverses implementation and integration"
	, async () => {
		const value = await record();
		for(const update of value.updates)
		{
			const current = blob(ownedJavaScriptCiBudgetRepairImplementation
				, update.path);
			const previous = blob(ownedJavaScriptCiBudgetRepairPredecessor
				, update.path);
			assert.equal(reverseOwnedJavaScriptCiBudgetRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeOwnedJavaScriptCiBudgetRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = blob(ownedJavaScriptCiBudgetRepairImplementation
				, update.path);
			assert.equal(reverseOwnedJavaScriptCiBudgetRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of ownedJavaScriptCiBudgetRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("owned JavaScript budget repair refreshes exactly ninety-two live pins"
	, async () => {
		const value = await record();
		const workflow = ".github/workflows/consumer-matrix.yml";
		const entry = value.refreshed[workflow];
		assert.deepEqual(Object.keys(value.refreshed), [workflow]);
		assert.equal(entry.count, 92);
		assert.equal(entry.previous, sha256(blob(
			ownedJavaScriptCiBudgetRepairPredecessor, workflow)));
		assert.equal(entry.current, sha256(blob(
			ownedJavaScriptCiBudgetRepairImplementation, workflow)));
		const inventoryUpdate = value.integrationUpdates.find(update =>
			update.path === "docs/type-surface.v1.json");
		assert.ok(inventoryUpdate);
		const current = await sourceAtFinHistoryMilestone(
			inventoryUpdate.path, inventoryUpdate.currentSha256);
		assert.equal(current.split(entry.current).length - 1, 92);
		assert.equal(current.replaceAll(entry.current, entry.previous)
			, blob(ownedJavaScriptCiBudgetRepairImplementation
				, "docs/type-surface.v1.json"));
		assert.deepEqual(value.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("owned JavaScript budget repair authenticates additions and forgeries"
	, async () => {
		const value = await record();
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, ownedJavaScriptCiBudgetRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = value.updates[0];
		const current = blob(ownedJavaScriptCiBudgetRepairImplementation
			, update.path);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() => reverseOwnedJavaScriptCiBudgetRepairUpdate(
			current, forged));
		assert.equal(beforeOwnedJavaScriptCiBudgetRepairSource(
			"unknown.mjs", current), current);
		const copy = spawnSync(process.execPath, [
			"scripts/update-owned-javascript-ci-budget-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /History already exists|Expected values to be strictly equal/u);
	}
);
