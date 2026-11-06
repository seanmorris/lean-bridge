/**
 * Authenticate the final audit checkout optimizations and pin reconciliation.
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
	beforeFinalAuditCheckoutOptimizationSource
	, finalAuditCheckoutOptimizationCurrentSources
	, finalAuditCheckoutOptimizationHistoryAdditions
	, finalAuditCheckoutOptimizationHistoryPath
	, finalAuditCheckoutOptimizationImplementationAdditions
	, finalAuditCheckoutOptimizationIntegrationPaths
	, finalAuditCheckoutOptimizationOptionalImplementation
	, finalAuditCheckoutOptimizationPinRefresh
	, finalAuditCheckoutOptimizationPredecessor
	, finalAuditCheckoutOptimizationValueIndexImplementation
	, reverseFinalAuditCheckoutOptimizationUpdate
} from "./final-audit-checkout-optimization-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	finalAuditCheckoutOptimizationHistoryPath, "utf8"));
const withHistoricalSources = async (commit, paths, use) => {
	const repository = await mkdtemp(join(tmpdir()
		, "lean-final-audit-checkout-history-"));
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

test("final audit checkout history records the exact bounded optimization"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone
			, "final-audit-checkout-optimization-v1");
		assert.equal(value.predecessorCommit
			, finalAuditCheckoutOptimizationPredecessor);
		assert.equal(value.optionalImplementationCommit
			, finalAuditCheckoutOptimizationOptionalImplementation);
		assert.equal(value.valueIndexImplementationCommit
			, finalAuditCheckoutOptimizationValueIndexImplementation);
		assert.equal(value.pinRefreshCommit
			, finalAuditCheckoutOptimizationPinRefresh);
		assert.equal(value.refreshedPins, 26);
		assert.deepEqual(value.preflightBefore.findings.map(item => item.path)
			, finalAuditCheckoutOptimizationCurrentSources);
		assert.deepEqual(value.preflightAfter
			, { cohort: 2661, occurrences: 16326, findings: [] });
		assert.deepEqual(value.measurements, {
			optionalRetainedCorpusBytes: 1065300246
			, valueIndexBaselineCheckoutSeconds: 597
			, valueIndexSparseReplayTests: 28
			, valueIndexSparseMissingReads: 0
		});
	}
);

test("final audit checkout pin refresh is the exact generated reconciliation"
	, async () => {
		const value = await record();
		const before = JSON.parse(git(["show"
			, `${finalAuditCheckoutOptimizationValueIndexImplementation}:docs/type-surface.v1.json`]));
		assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
			before, finalAuditCheckoutOptimizationCurrentSources).sort()
			, finalAuditCheckoutOptimizationCurrentSources);
		const digests = new Map(value.currentSourceDigests.map(
			item => [item.path, item.sha256]));
		const reconciled = reconcileDependentCheckedRecordSourcePins(
			before, digests);
		assert.equal(reconciled.refreshed, 26);
		assert.deepEqual(reconciled.inventory, JSON.parse(git(["show"
			, `${finalAuditCheckoutOptimizationPinRefresh}:docs/type-surface.v1.json`])));
		assert.deepEqual(reconciled.inventory.profiles, before.profiles);
		assert.deepEqual(reconciled.inventory.observations, before.observations);
		await withHistoricalSources(
			finalAuditCheckoutOptimizationValueIndexImplementation
			, finalAuditCheckoutOptimizationCurrentSources
			, async repository => {
				const prior = await auditCurrentSourcePins(before, {
					repository
					, paths: finalAuditCheckoutOptimizationCurrentSources
				});
				assert.deepEqual(prior.findings, value.preflightBefore.findings);
				assert.deepEqual(previewCurrentSourcePinRefresh(before, prior)
					, { paths: 4, refreshed: 26 });
				const after = await auditCurrentSourcePins(reconciled.inventory, {
					repository
					, paths: finalAuditCheckoutOptimizationCurrentSources
				});
				assert.equal(after.cohort, 4);
				assert.equal(after.occurrences, 26);
				assert.deepEqual(after.findings, []);
			}
		);
	}
);

test("final audit checkout history reverses implementation, pin and integration"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationUpdates.map(item => item.path)
			, finalAuditCheckoutOptimizationCurrentSources);
		for(const update of value.implementationUpdates)
		{
			const current = git(["show"
				, `${finalAuditCheckoutOptimizationValueIndexImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${finalAuditCheckoutOptimizationPredecessor}:${update.path}`]);
			assert.equal(reverseFinalAuditCheckoutOptimizationUpdate(
				current, update), previous, update.path);
		}
		assert.deepEqual(value.pinUpdates.map(item => item.path)
			, ["docs/type-surface.v1.json"]);
		for(const update of value.pinUpdates)
			assert.equal(reverseFinalAuditCheckoutOptimizationUpdate(git(["show"
				, `${finalAuditCheckoutOptimizationPinRefresh}:${update.path}`])
			, update), git(["show"
				, `${finalAuditCheckoutOptimizationValueIndexImplementation}:${update.path}`]));
		assert.deepEqual(value.integrationUpdates.map(item => item.path)
			, finalAuditCheckoutOptimizationIntegrationPaths);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				finalAuditCheckoutOptimizationHistoryPath, update.path
					, update.currentSha256);
			const previous = git(["show"
				, `${finalAuditCheckoutOptimizationPinRefresh}:${update.path}`]);
			assert.equal(reverseFinalAuditCheckoutOptimizationUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("final audit checkout history authenticates additions and exact model"
	, async () => {
		const value = await record();
		assert.equal(value.exactModel.cells, 1054);
		assert.equal(value.exactModel.stageEntries, 5270);
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, finalAuditCheckoutOptimizationImplementationAdditions);
		for(const addition of value.implementationAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${finalAuditCheckoutOptimizationPredecessor}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(git(["show"
				, `${finalAuditCheckoutOptimizationValueIndexImplementation}:${addition.path}`]))
				, addition.sha256, addition.path);
		}
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, finalAuditCheckoutOptimizationHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		for(const path of finalAuditCheckoutOptimizationIntegrationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		const forged = value.implementationUpdates[0];
		assert.throws(() => reverseFinalAuditCheckoutOptimizationUpdate(
			git(["show"
				, `${finalAuditCheckoutOptimizationValueIndexImplementation}:${forged.path}`])
			, { ...forged, currentSha256: "0".repeat(64) }));
		assert.equal(beforeFinalAuditCheckoutOptimizationSource(
			"unknown", "source"), "source");
	}
);
