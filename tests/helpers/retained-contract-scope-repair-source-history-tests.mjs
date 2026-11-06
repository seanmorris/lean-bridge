/**
 * Authenticate the retained-contract scope and JVM observation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertRetainedContractScopeRepair
	, beforeRetainedContractScopeRepairSource
	, retainedContractScopeRepairHistoryAdditions
	, retainedContractScopeRepairHistoryPath
	, retainedContractScopeRepairImplementation
	, retainedContractScopeRepairImplementationAdditions
	, retainedContractScopeRepairImplementationPaths
	, retainedContractScopeRepairIntegrationPaths
	, retainedContractScopeRepairNormalizationPaths
	, retainedContractScopeRepairPredecessor
	, reverseRetainedContractScopeRepairUpdate
} from "./retained-contract-scope-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	retainedContractScopeRepairHistoryPath, "utf8"));

test("retained-contract scope repair records one exact implementation parent"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone, "retained-contract-scope-repair-source-v1");
		assert.equal(value.predecessorCommit
			, retainedContractScopeRepairPredecessor);
		assert.equal(value.implementationCommit
			, retainedContractScopeRepairImplementation);
		assert.equal(git(["rev-parse"
			, `${retainedContractScopeRepairImplementation}^`]).trim()
			, retainedContractScopeRepairPredecessor);
		assert.deepEqual(value.behavior, {
			deferredConsumerJobs: 6, retainedEntrypoints: 2
			, currentJvmRows: 12047, historicalJvmRows: 12046
		});
		assert.equal(value.changedSupportCells, 0);
		assert.equal(value.runtimeSemanticChanges, 0);
	}
);

test("retained-contract repair binds current behavior and historical evidence"
	, async () => {
		const paths = [
			...retainedContractScopeRepairImplementationPaths
			, ...retainedContractScopeRepairImplementationAdditions
		];
		const sources = Object.fromEntries(paths.map(path => [path
		, git([
			"show", `${retainedContractScopeRepairImplementation}:${path}`
		])]));
		assert.deepEqual(assertRetainedContractScopeRepair(sources), {
			deferredConsumerJobs: 6, retainedEntrypoints: 2
			, currentJvmRows: 12047, historicalJvmRows: 12046
			, changedSupportCells: 0, runtimeSemanticChanges: 0
		});
		const changed = structuredClone(sources);
		changed[".github/workflows/quality.yml"] = changed[
			".github/workflows/quality.yml"].replace(
				"LEAN_BRIDGE_RETAINED_CONTRACTS: required"
				, "LEAN_BRIDGE_RETAINED_CONTRACTS: deferred");
		assert.throws(() => assertRetainedContractScopeRepair(changed));
	}
);

test("retained-contract scope repair reverses every authenticated source"
	, async () => {
		const value = await record();
		assert.deepEqual(value.updates.map(update => update.path)
			, retainedContractScopeRepairImplementationPaths);
		for(const update of value.updates)
		{
			const current = git(["show"
				, `${retainedContractScopeRepairImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${retainedContractScopeRepairPredecessor}:${update.path}`]);
			assert.equal(reverseRetainedContractScopeRepairUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeRetainedContractScopeRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, retainedContractScopeRepairIntegrationPaths);
		for(const update of value.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				retainedContractScopeRepairHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${retainedContractScopeRepairImplementation}:${update.path}`]);
			assert.equal(reverseRetainedContractScopeRepairUpdate(current, update)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("retained-contract repair authenticates additions and unchanged model"
	, async () => {
		const value = await record();
		assert.deepEqual(value.implementationAdditions.map(item => item.path)
			, retainedContractScopeRepairImplementationAdditions);
		for(const addition of value.implementationAdditions)
		{
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${retainedContractScopeRepairPredecessor}:${addition.path}`]
				, { stdio: "ignore" }).status, 0, addition.path);
			assert.equal(sha256(git(["show"
				, `${retainedContractScopeRepairImplementation}:${addition.path}`]))
				, addition.sha256, addition.path);
		}
		assert.equal(value.exactModel.cells, 1054);
		assert.equal(value.exactModel.stageEntries, 5270);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, retainedContractScopeRepairHistoryAdditions);
		for(const addition of value.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		for(const path of [
			...retainedContractScopeRepairImplementationPaths
			, ...retainedContractScopeRepairIntegrationPaths
		]) {
			assert.ok(retainedContractScopeRepairNormalizationPaths.includes(path)
				, path);
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
		}
	}
);
