/**
 * Authenticate the installed-Perl callback evidence argument repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPerlCallbackModuleArgumentRepair
	, beforePerlCallbackModuleArgumentRepairSource
	, perlCallbackModuleArgumentRepairHistoryAdditions
	, perlCallbackModuleArgumentRepairHistoryPath
	, perlCallbackModuleArgumentRepairImplementation
	, perlCallbackModuleArgumentRepairImplementationPaths
	, perlCallbackModuleArgumentRepairIntegrationPaths
	, perlCallbackModuleArgumentRepairPredecessor
	, reversePerlCallbackModuleArgumentRepairUpdate
} from "./perl-callback-module-argument-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { authenticateSourceHistoryReverse, gitSourceBytes }
	from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	perlCallbackModuleArgumentRepairHistoryPath, "utf8"));

test("Perl callback argument repair records the exact hosted failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "perl-callback-module-argument-repair-source-v1");
	assert.equal(history.predecessorCommit
		, perlCallbackModuleArgumentRepairPredecessor);
	assert.equal(history.implementationCommit
		, perlCallbackModuleArgumentRepairImplementation);
	assert.deepEqual(history.hostedFailure, {
		runId: 41242839565, jobId: 124662134912
		, artifactId: 13062220600
		, logSha256: "b05a501f10bdb9999801667edfefb8c4039e625017cc7ed91db701efa0fb1663"
		, tests: 16, passed: 12, failed: 4
		, unexpectedArgument: "LeanBridge::OwnedProbe"
	});
	assert.deepEqual(history.updates.map(item => item.path)
		, perlCallbackModuleArgumentRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, perlCallbackModuleArgumentRepairIntegrationPaths);
});

test("Perl callback argument repair binds both evidence readers", () => {
	for(const path of perlCallbackModuleArgumentRepairImplementationPaths)
	{
		const source = git(["show"
			, `${perlCallbackModuleArgumentRepairImplementation}:${path}`]);
		assert.deepEqual(assertPerlCallbackModuleArgumentRepair(path, source)
			, { installedModuleArgument: true });
	}
});

test("Perl callback argument repair reverses every authenticated source"
	, async () => {
		const history = await record();
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				perlCallbackModuleArgumentRepairImplementation, update.path), update)
			, true, update.path);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${perlCallbackModuleArgumentRepairImplementation}:${update.path}`]);
			assert.equal(reversePerlCallbackModuleArgumentRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforePerlCallbackModuleArgumentRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...perlCallbackModuleArgumentRepairImplementationPaths
			, ...perlCallbackModuleArgumentRepairIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("Perl callback argument repair preserves the runtime result", async () => {
	const history = await record();
	assert.deepEqual(history.validation, {
		hostedRuntimeTestsPassed: 41
		, affectedReconstructionTestsPassed: 4
		, optionalPackageForgeriesRejected: 438
		, runtimeSemanticChanges: 0
	});
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.evidenceContractChanges, 2);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, perlCallbackModuleArgumentRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
});

test("Perl callback argument repair rejects forgeries and another writer"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${perlCallbackModuleArgumentRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reversePerlCallbackModuleArgumentRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-perl-callback-module-argument-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|implementation revision/u);
	}
);
