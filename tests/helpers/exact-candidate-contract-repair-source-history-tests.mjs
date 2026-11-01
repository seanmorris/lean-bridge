/**
 * Authenticate the exact-candidate CI contract and checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertExactCandidateContractRepair
	, beforeExactCandidateContractRepairSource
	, exactCandidateContractRepairHistoryAdditions
	, exactCandidateContractRepairHistoryPath
	, exactCandidateContractRepairImplementation
	, exactCandidateContractRepairImplementationPaths
	, exactCandidateContractRepairIntegrationPaths
	, exactCandidateContractRepairPredecessor
	, reverseExactCandidateContractRepairUpdate
} from "./exact-candidate-contract-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	exactCandidateContractRepairHistoryPath, "utf8"));

test("exact-candidate repair records every observed failure class", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "exact-candidate-contract-repair-source-v1");
	assert.equal(history.predecessorCommit
		, exactCandidateContractRepairPredecessor);
	assert.equal(history.implementationCommit
		, exactCandidateContractRepairImplementation);
	assert.deepEqual(history.candidate, {
		commit: "766fd12a6297fe52fe3eeccc77105aacb2f32903"
		, coreRunId: 41242839492, downstreamRunId: 41242839565
		, coreContractFailureJobs: [124667145154, 124667145164]
		, downstreamContractFailureJobs: [
			124662134912, 124662134998, 124662135038
			, 124662135074, 124679799351
		]
		, infrastructureJobs: [124662134855, 124662134876, 124662134915]
	});
	assert.deepEqual(history.updates.map(item => item.path)
		, exactCandidateContractRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, exactCandidateContractRepairIntegrationPaths);
});

test("exact-candidate repair binds every implementation source", () => {
	for(const path of exactCandidateContractRepairImplementationPaths)
	{
		const source = git(["show"
			, `${exactCandidateContractRepairImplementation}:${path}`]);
		assert.equal(assertExactCandidateContractRepair(path, source), true, path);
	}
});

test("exact-candidate repair reverses every authenticated source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			exactCandidateContractRepairImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${exactCandidateContractRepairImplementation}:${update.path}`]);
		assert.equal(reverseExactCandidateContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeExactCandidateContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...exactCandidateContractRepairImplementationPaths
		, ...exactCandidateContractRepairIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("exact-candidate repair preserves support while reducing CI cost", async () => {
	const history = await record();
	assert.deepEqual(history.validation, {
		perlWorkflowContractTestsPassed: 104
		, focusedHistoryAndSparseTestsPassed: 12
		, reviewedSubtypeTestsPassed: 5
		, perlFinArchiveBeforeMs: 251308, perlFinArchiveAfterMs: 6970
		, perlFinXsBeforeMs: 250989, perlFinXsAfterMs: 7048
		, phpWasmHistoryBeforeObservedMs: 364000
		, phpWasmHistoryBeforeTerminated: true, phpWasmHistoryAfterMs: 7756
		, runtimeSemanticChanges: 0
	});
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.sourceContractChanges, 14);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, exactCandidateContractRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
});

test("exact-candidate repair rejects forgeries and another writer", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${exactCandidateContractRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseExactCandidateContractRepairUpdate(current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-exact-candidate-contract-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /already exists|implementation revision/u);
});
