/**
 * Authenticate the complete current-source pin refresh and aggregate preflight.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
	auditCurrentSourcePins, previewCurrentSourcePinRefresh
} from "./current-source-pin-preflight.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "./dependent-checked-record-promotion.mjs";
import {
	beforeCompleteCurrentSourcePinPreflightSource
	, completeCurrentSourcePinPreflightCurrentSources
	, completeCurrentSourcePinPreflightHistoryAdditions
	, completeCurrentSourcePinPreflightHistoryPath
	, completeCurrentSourcePinPreflightImplementation
	, completeCurrentSourcePinPreflightImplementationAdditions
	, completeCurrentSourcePinPreflightImplementationPaths
	, completeCurrentSourcePinPreflightIntegrationPaths
	, completeCurrentSourcePinPreflightPinRefresh
	, completeCurrentSourcePinPreflightPredecessor
	, reverseCompleteCurrentSourcePinPreflightUpdate
} from "./complete-current-source-pin-preflight-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	completeCurrentSourcePinPreflightHistoryPath, "utf8"));
const withHistoricalSources = async (commit, paths, use) => {
	const repository = await mkdtemp(join(tmpdir()
		, "lean-complete-pin-preflight-history-"));
	try
	{
		for(const path of paths)
		{
			const target = join(repository, path);
			await mkdir(dirname(target), { recursive: true });
			await writeFile(target, git(["show", `${commit}:${path}`]));
		}
		return await use(repository);
	}
	finally
	{
		await rm(repository, { recursive: true, force: true });
	}
};

test("complete current-source preflight records the whole discovered cohort"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "complete-current-source-pin-preflight-v1");
		assert.equal(value.predecessorCommit
			, completeCurrentSourcePinPreflightPredecessor);
		assert.equal(value.pinRefreshCommit
			, completeCurrentSourcePinPreflightPinRefresh);
		assert.equal(value.implementationCommit
			, completeCurrentSourcePinPreflightImplementation);
		assert.equal(value.discovery.completeCohortPaths, 2661);
		assert.equal(value.discovery.completeCohortPinOccurrences, 16326);
		assert.equal(value.discovery.stalePaths, 5);
		assert.equal(value.discovery.stalePinOccurrences, 216);
		assert.deepEqual(value.discovery.findings.map(item => item.path)
			, completeCurrentSourcePinPreflightCurrentSources);
		assert.equal(value.refreshedPins, 216);
		assert.deepEqual(value.finalPreflight
			, { cohort: 2661, occurrences: 16326, findings: [] });
	}
);

test("complete current-source refresh is the exact generated reconciliation"
	, async () => {
		const value = await record();
		const before = JSON.parse(git(["show"
			, `${completeCurrentSourcePinPreflightPredecessor}:docs/type-surface.v1.json`]));
		assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
			before, completeCurrentSourcePinPreflightCurrentSources).sort()
			, completeCurrentSourcePinPreflightCurrentSources);
		const currentDigests = new Map(value.currentSourceDigests.map(
			item => [item.path, item.sha256]));
		const reconciled = reconcileDependentCheckedRecordSourcePins(
			before, currentDigests);
		assert.equal(reconciled.refreshed, 216);
		assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
			, `${completeCurrentSourcePinPreflightPinRefresh}:docs/type-surface.v1.json`])));
		assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
			, `${completeCurrentSourcePinPreflightImplementation}:docs/type-surface.v1.json`])));
		assert.deepEqual(reconciled.inventory.profiles, before.profiles);
		assert.deepEqual(reconciled.inventory.observations, before.observations);
		await withHistoricalSources(completeCurrentSourcePinPreflightPredecessor
			, completeCurrentSourcePinPreflightCurrentSources
			, async repository => {
				const prior = await auditCurrentSourcePins(before, {
					repository, paths: completeCurrentSourcePinPreflightCurrentSources
				});
				assert.deepEqual(prior.findings, value.discovery.findings);
				assert.deepEqual(previewCurrentSourcePinRefresh(before, prior)
					, { paths: 5, refreshed: 216 });
			}
		);
		await withHistoricalSources(completeCurrentSourcePinPreflightImplementation
			, completeCurrentSourcePinPreflightCurrentSources
			, async repository => {
				const after = await auditCurrentSourcePins(reconciled.inventory, {
					repository, paths: completeCurrentSourcePinPreflightCurrentSources
				});
				assert.equal(after.cohort, 5);
				assert.equal(after.occurrences, 216);
				assert.deepEqual(after.findings, []);
			}
		);
	}
);

test("complete current-source preflight reverses both recorded stages"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationUpdates.map(item => item.path)
			, completeCurrentSourcePinPreflightImplementationPaths);
		for(const update of value.implementationUpdates)
		{
			const current = git(["show"
				, `${completeCurrentSourcePinPreflightImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${completeCurrentSourcePinPreflightPredecessor}:${update.path}`]);
			assert.equal(reverseCompleteCurrentSourcePinPreflightUpdate(
				current, update), previous, update.path);
		}
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, completeCurrentSourcePinPreflightIntegrationPaths);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				completeCurrentSourcePinPreflightHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${completeCurrentSourcePinPreflightImplementation}:${update.path}`]);
			assert.equal(reverseCompleteCurrentSourcePinPreflightUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("complete current-source preflight authenticates additions and model"
	, async () => {
		const value = await record();
		assert.equal(value.exactModel.cells, 1054);
		assert.equal(value.exactModel.stageEntries, 5270);
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, completeCurrentSourcePinPreflightImplementationAdditions);
		for(const addition of value.implementationAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${completeCurrentSourcePinPreflightPredecessor}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(git(["show"
				, `${completeCurrentSourcePinPreflightImplementation}:${addition.path}`]))
				, addition.sha256, addition.path);
		}
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, completeCurrentSourcePinPreflightHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		for(const path of completeCurrentSourcePinPreflightIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const forged = value.implementationUpdates[0];
		assert.throws(() => reverseCompleteCurrentSourcePinPreflightUpdate(
			git(["show"
				, `${completeCurrentSourcePinPreflightImplementation}:${forged.path}`])
			, { ...forged, currentSha256: "0".repeat(64) }));
		assert.equal(beforeCompleteCurrentSourcePinPreflightSource(
			"unknown", "source"), "source");
	}
);
