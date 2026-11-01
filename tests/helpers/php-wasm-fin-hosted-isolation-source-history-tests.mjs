/**
 * Authenticate the hosted PHP-Wasm Fin probe isolation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPhpWasmFinHostedIsolation
	, beforePhpWasmFinHostedIsolationSource
	, phpWasmFinHostedIsolationHistoryAdditions
	, phpWasmFinHostedIsolationHistoryPath
	, phpWasmFinHostedIsolationImplementation
	, phpWasmFinHostedIsolationImplementationPaths
	, phpWasmFinHostedIsolationIntegrationPaths
	, phpWasmFinHostedIsolationPredecessor
	, reversePhpWasmFinHostedIsolationUpdate
} from "./php-wasm-fin-hosted-isolation-source-history.mjs";
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
	phpWasmFinHostedIsolationHistoryPath, "utf8"));

test("hosted PHP-Wasm Fin isolation records the exact diagnostic failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "php-wasm-fin-hosted-isolation-source-v1");
	assert.equal(history.predecessorCommit
		, phpWasmFinHostedIsolationPredecessor);
	assert.equal(history.implementationCommit
		, phpWasmFinHostedIsolationImplementation);
	assert.deepEqual(history.candidate, {
		commit: "766fd12a6297fe52fe3eeccc77105aacb2f32903"
		, downstreamRunId: 41242839565
		, cFamilyJobId: 124679799163
		, phpWasmRefinementJobId: 124679799405
		, phpWasmRefinementFailedTests: 43
	});
	assert.deepEqual(history.updates.map(item => item.path)
		, phpWasmFinHostedIsolationImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, phpWasmFinHostedIsolationIntegrationPaths);
});

test("hosted PHP-Wasm Fin isolation binds both implementation sources", () => {
	for(const path of phpWasmFinHostedIsolationImplementationPaths)
	{
		const source = git(["show"
			, `${phpWasmFinHostedIsolationImplementation}:${path}`]);
		assert.equal(assertPhpWasmFinHostedIsolation(path, source), true, path);
	}
});

test("hosted PHP-Wasm Fin isolation reverses every authenticated source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			phpWasmFinHostedIsolationImplementation, update.path), update)
		, true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${phpWasmFinHostedIsolationImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmFinHostedIsolationUpdate(
			current, update), previous, update.path);
		assert.equal(beforePhpWasmFinHostedIsolationSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...phpWasmFinHostedIsolationImplementationPaths
		, ...phpWasmFinHostedIsolationIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("hosted PHP-Wasm Fin isolation preserves support and bounds execution", async () => {
	const history = await record();
	assert.deepEqual(history.validation, {
		selectionProbeTests: 1, selectionProbeSkipped: 1
		, selectionProbeDurationMs: 1445
		, priorHostedStepDurationSeconds: 6759
		, runtimeSemanticChanges: 0
	});
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.sourceContractChanges, 2);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, phpWasmFinHostedIsolationHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
});

test("hosted PHP-Wasm Fin isolation rejects forgeries and another writer", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${phpWasmFinHostedIsolationImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reversePhpWasmFinHostedIsolationUpdate(current, forged));
	const copy = spawnSync(process.execPath, [
		"scripts/update-php-wasm-fin-hosted-isolation-source-history.mjs"
	], { encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(copy.stdout + copy.stderr
		, /already exists|implementation revision/u);
});
