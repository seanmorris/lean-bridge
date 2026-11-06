/**
 * Authenticate the bounded Performance checkout optimization and pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	auditCurrentSourcePins, previewCurrentSourcePinRefresh
} from "./current-source-pin-preflight.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	beforePerformanceCheckoutFilterSource
	, performanceCheckoutFilterCurrentSources
	, performanceCheckoutFilterHistoryAdditions
	, performanceCheckoutFilterHistoryPath
	, performanceCheckoutFilterImplementation
	, performanceCheckoutFilterIntegrationPaths
	, performanceCheckoutFilterPinRefresh
	, performanceCheckoutFilterPredecessor
	, reversePerformanceCheckoutFilterUpdate
} from "./performance-checkout-filter-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	performanceCheckoutFilterHistoryPath, "utf8"));

test("performance checkout filter history records exact boundaries", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "performance-checkout-filter-v1");
	assert.equal(value.predecessorCommit, performanceCheckoutFilterPredecessor);
	assert.equal(value.implementationCommit, performanceCheckoutFilterImplementation);
	assert.equal(value.pinRefreshCommit, performanceCheckoutFilterPinRefresh);
	assert.deepEqual(git(["diff", "--name-only"
		, performanceCheckoutFilterPredecessor
		, performanceCheckoutFilterImplementation]).trim().split("\n").sort()
		, [...performanceCheckoutFilterCurrentSources].sort());
	assert.deepEqual(git(["diff", "--name-only"
		, performanceCheckoutFilterImplementation
		, performanceCheckoutFilterPinRefresh]).trim().split("\n")
		, [inventoryPath]);
	assert.deepEqual(value.implementationUpdates.map(item => item.path)
		, performanceCheckoutFilterCurrentSources);
	assert.deepEqual(value.pinUpdates.map(item => item.path), [inventoryPath]);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, performanceCheckoutFilterIntegrationPaths);
});

test("performance checkout filter refreshes the one live workflow citation"
	, async () => {
		const before = JSON.parse(git(["show"
			, `${performanceCheckoutFilterImplementation}:${inventoryPath}`]));
		assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
			before, performanceCheckoutFilterCurrentSources)
			, [performanceCheckoutFilterCurrentSources[0]]);
		const digests = new Map(performanceCheckoutFilterCurrentSources.map(
			path => [path
				, sha256(git(["show"
					, `${performanceCheckoutFilterImplementation}:${path}`]))]));
		const reconciled = reconcileDependentCheckedRecordSourcePins(before, digests);
		assert.equal(reconciled.refreshed, 1);
		assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
			, `${performanceCheckoutFilterPinRefresh}:${inventoryPath}`])));
		const preflight = await auditCurrentSourcePins(before);
		assert.deepEqual(preflight.findings.map(item => item.path)
			, [performanceCheckoutFilterCurrentSources[0]]);
		assert.deepEqual(previewCurrentSourcePinRefresh(before, preflight)
			, { paths: 1, refreshed: 1 });
		assert.deepEqual(await auditCurrentSourcePins(reconciled.inventory)
			, { cohort: 2661, occurrences: 16326, findings: [] });
	}
);

test("performance checkout filter reverses implementation, pin and integration"
	, async () => {
		const value = await record();
		for(const update of value.implementationUpdates)
		{
			const current = git(["show"
				, `${performanceCheckoutFilterImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${performanceCheckoutFilterPredecessor}:${update.path}`]);
			assert.equal(reversePerformanceCheckoutFilterUpdate(current, update)
				, previous, update.path);
		}
		for(const update of value.pinUpdates)
			assert.equal(reversePerformanceCheckoutFilterUpdate(git(["show"
				, `${performanceCheckoutFilterPinRefresh}:${update.path}`]), update)
				, git(["show"
					, `${performanceCheckoutFilterImplementation}:${update.path}`]));
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				performanceCheckoutFilterHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${performanceCheckoutFilterPinRefresh}:${update.path}`]);
			assert.equal(reversePerformanceCheckoutFilterUpdate(current, update)
				, previous, update.path);
			assert.equal(beforePerformanceCheckoutFilterSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("performance checkout filter authenticates additions and unchanged model"
	, async () => {
		const value = await record();
		assert.equal(value.exactModel.cells, 1054);
		assert.equal(value.exactModel.stageEntries, 5270);
		assert.equal(value.refreshedPins, 1);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, performanceCheckoutFilterHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${performanceCheckoutFilterPinRefresh}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of performanceCheckoutFilterIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const sources = [performanceCheckoutFilterPredecessor
			, performanceCheckoutFilterImplementation
			, performanceCheckoutFilterPinRefresh].map(commit =>
			git(["show", `${commit}:${exactModelPath}`]));
		assert.equal(new Set(sources.map(source => sha256(source))).size, 1);
		const forged = value.implementationUpdates[0];
		assert.throws(() => reversePerformanceCheckoutFilterUpdate(
			git(["show"
				, `${performanceCheckoutFilterImplementation}:${forged.path}`])
			, { ...forged, currentSha256: "0".repeat(64) }));
	}
);
