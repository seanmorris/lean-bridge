/**
 * Authenticate the exact-head Core and Native PHP replay contract repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertExactHeadReplayContractRepair
	, beforeExactHeadReplayContractRepairSource
	, exactHeadReplayContractRepairHistoryAdditions
	, exactHeadReplayContractRepairHistoryPath
	, exactHeadReplayContractRepairImplementation
	, exactHeadReplayContractRepairImplementationPaths
	, exactHeadReplayContractRepairIntegrationPaths
	, exactHeadReplayContractRepairPredecessor
	, reverseExactHeadReplayContractRepairUpdate
} from "./exact-head-replay-contract-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	exactHeadReplayContractRepairHistoryPath, "utf8"));

test("exact-head replay repair records both hosted discoveries", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "exact-head-replay-contract-repair-source-v1");
	assert.equal(history.predecessorCommit
		, exactHeadReplayContractRepairPredecessor);
	assert.equal(history.implementationCommit
		, exactHeadReplayContractRepairImplementation);
	assert.deepEqual(history.discovery.map(item => [item.run, item.job]), [
		[41353878183, 124999140853]
		, [41353878302, 124996984188]
	]);
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.runtimeSemanticChanges, 0);
	assert.equal(history.livePinRefreshes, 1);
});

test("exact-head replay repair binds the complete current contract", () => {
	const sources = Object.fromEntries(
		exactHeadReplayContractRepairImplementationPaths.map(path => [path
			, git(["show"
				, `${exactHeadReplayContractRepairImplementation}:${path}`])])
	);
	assert.deepEqual(assertExactHeadReplayContractRepair(sources), {
		livePinRefreshes: 1, changedSupportCells: 0
	});
	for(const mutate of [
		value => { value["tests/helpers/reviewed-fin-refusal-ci-tests.mjs"]
			= value["tests/helpers/reviewed-fin-refusal-ci-tests.mjs"]
				.replace('["ordinary_c", "type_corpus_c_family"]'
					, '["ordinary_c", "unrelated"]'); }
		, value => { value["tests/helpers/reviewed-fin-wasm-refusal-evidence.mjs"]
			= value["tests/helpers/reviewed-fin-wasm-refusal-evidence.mjs"]
				.replaceAll("reviewedFinWasmPreFieldIr", "reviewedFinWasmIr"); }
		, value => { value[
			"tests/fixtures/structured-callable-consumers/php-recursive-ownership.php"]
			= value[
				"tests/fixtures/structured-callable-consumers/php-recursive-ownership.php"]
				.replace(",$frame,null);", ",$frame);"); }
	]) {
		const changed = structuredClone(sources); mutate(changed);
		assert.throws(() => assertExactHeadReplayContractRepair(changed));
	}
});

test("exact-head replay repair reverses every authenticated source", async () => {
	const history = await record();
	assert.deepEqual(history.updates.map(update => update.path)
		, exactHeadReplayContractRepairImplementationPaths);
	for(const update of history.updates)
	{
		const current = git(["show"
			, `${exactHeadReplayContractRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${exactHeadReplayContractRepairPredecessor}:${update.path}`]);
		assert.equal(reverseExactHeadReplayContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeExactHeadReplayContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, exactHeadReplayContractRepairIntegrationPaths);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			exactHeadReplayContractRepairHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${exactHeadReplayContractRepairImplementation}:${update.path}`]);
		assert.equal(reverseExactHeadReplayContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...exactHeadReplayContractRepairImplementationPaths
		, ...exactHeadReplayContractRepairIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("exact-head replay repair additions are immutable", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, exactHeadReplayContractRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = git(["show"
		, `${exactHeadReplayContractRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseExactHeadReplayContractRepairUpdate(current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-exact-head-replay-contract-repair-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /already exists|Expected values to be strictly equal/u);
});
