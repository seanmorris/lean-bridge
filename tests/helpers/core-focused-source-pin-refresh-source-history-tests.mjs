/**
 * Authenticate the focused Core current-source pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";
import {
	beforeCoreFocusedSourcePinRefreshSource
	, coreFocusedSourcePinRefreshCurrentSources
	, coreFocusedSourcePinRefreshHistoryAdditions
	, coreFocusedSourcePinRefreshHistoryPath
	, coreFocusedSourcePinRefreshImplementation
	, coreFocusedSourcePinRefreshImplementationCurrentSources
	, coreFocusedSourcePinRefreshImplementationPaths
	, coreFocusedSourcePinRefreshIntegrationPaths
	, coreFocusedSourcePinRefreshPredecessor
	, reverseCoreFocusedSourcePinRefreshUpdate
} from "./core-focused-source-pin-refresh-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	coreFocusedSourcePinRefreshHistoryPath, "utf8"));

test("focused source-pin refresh records exact boundaries and counts", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "core-focused-source-pin-refresh-v1");
	assert.equal(value.predecessorCommit, coreFocusedSourcePinRefreshPredecessor);
	assert.equal(value.implementationCommit
		, coreFocusedSourcePinRefreshImplementation);
	assert.equal(value.implementationRefreshedPins, 177);
	assert.equal(value.integrationRefreshedPins, 0);
	assert.equal(value.refreshedPins
		, value.implementationRefreshedPins + value.integrationRefreshedPins);
	assert.deepEqual(value.currentSourcePaths
		, coreFocusedSourcePinRefreshCurrentSources);
});

test("focused source-pin refresh is the exact generated reconciliation"
	, async () => {
		const value = await record();
		const before = JSON.parse(git(["show"
			, `${coreFocusedSourcePinRefreshPredecessor}:docs/type-surface.v1.json`]));
		const implementationDigests = new Map(value.currentSourceDigests
			.filter(item => coreFocusedSourcePinRefreshImplementationCurrentSources
				.includes(item.path)).map(item => [item.path, item.sha256]));
		const implementation = reconcileDependentCheckedRecordSourcePins(
			before, implementationDigests);
		assert.equal(implementation.refreshed, 177);
		assert.deepEqual(implementation.inventory, JSON.parse(git(["show"
			, `${coreFocusedSourcePinRefreshImplementation}:docs/type-surface.v1.json`])));
		const final = implementation;
		assert.equal(final.refreshed, value.refreshedPins);
		const implementationSource = git(["show"
			, `${coreFocusedSourcePinRefreshImplementation}:docs/type-surface.v1.json`]);
		assert.deepEqual(final.inventory, JSON.parse(
			await sourceAtFinHistoryMilestone(
				"docs/type-surface.v1.json", sha256(implementationSource))));
		assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
			before, coreFocusedSourcePinRefreshCurrentSources).sort()
			, coreFocusedSourcePinRefreshCurrentSources);
		assert.deepEqual(final.inventory.profiles, before.profiles);
		assert.deepEqual(final.inventory.observations, before.observations);
	}
);

test("focused source-pin refresh reverses implementation and integration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationUpdates.map(item => item.path)
			, coreFocusedSourcePinRefreshImplementationPaths);
		for(const update of value.implementationUpdates)
		{
			const current = git(["show"
				, `${coreFocusedSourcePinRefreshImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${coreFocusedSourcePinRefreshPredecessor}:${update.path}`]);
			assert.equal(reverseCoreFocusedSourcePinRefreshUpdate(current, update)
				, previous, update.path);
		}
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, coreFocusedSourcePinRefreshIntegrationPaths);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				coreFocusedSourcePinRefreshHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${coreFocusedSourcePinRefreshImplementation}:${update.path}`]);
			assert.equal(reverseCoreFocusedSourcePinRefreshUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("focused source-pin refresh authenticates controls and unchanged model"
	, async () => {
		const value = await record();
		assert.equal(value.exactModel.cells, 1054);
		assert.equal(value.exactModel.stageEntries, 5270);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, coreFocusedSourcePinRefreshHistoryAdditions);
		for(const addition of value.historyAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${coreFocusedSourcePinRefreshImplementation}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		}
		for(const path of coreFocusedSourcePinRefreshIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const forged = value.implementationUpdates[0];
		assert.throws(() => reverseCoreFocusedSourcePinRefreshUpdate(
			git(["show", `${coreFocusedSourcePinRefreshImplementation}:${forged.path}`])
			, { ...forged, currentSha256: "0".repeat(64) }));
		assert.equal(beforeCoreFocusedSourcePinRefreshSource(
			"unknown", "source"), "source");
	}
);
