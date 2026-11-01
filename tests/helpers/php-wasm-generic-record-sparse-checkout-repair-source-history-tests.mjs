/**
 * Authenticate the PHP-Wasm generic-record sparse-checkout repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPhpWasmGenericRecordSparseCheckoutRepair
	, beforePhpWasmGenericRecordSparseCheckoutRepairSource
	, phpWasmGenericRecordSparseCheckoutRepairHistoryAdditions
	, phpWasmGenericRecordSparseCheckoutRepairHistoryPath
	, phpWasmGenericRecordSparseCheckoutRepairImplementation
	, phpWasmGenericRecordSparseCheckoutRepairImplementationPaths
	, phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths
	, phpWasmGenericRecordSparseCheckoutRepairPinPaths
	, phpWasmGenericRecordSparseCheckoutRepairPinRepair
	, phpWasmGenericRecordSparseCheckoutRepairPredecessor
	, reversePhpWasmGenericRecordSparseCheckoutRepairUpdate
} from "./php-wasm-generic-record-sparse-checkout-repair-source-history.mjs";
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
	phpWasmGenericRecordSparseCheckoutRepairHistoryPath, "utf8"));

test("PHP-Wasm sparse repair records the exact hosted failure", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "php-wasm-generic-record-sparse-checkout-repair-v1");
	assert.equal(history.predecessorCommit
		, phpWasmGenericRecordSparseCheckoutRepairPredecessor);
	assert.equal(history.implementationCommit
		, phpWasmGenericRecordSparseCheckoutRepairImplementation);
	assert.equal(history.pinRepairCommit
		, phpWasmGenericRecordSparseCheckoutRepairPinRepair);
	assert.deepEqual(history.failedRun, {
		workflow: 41260205931, job: 124718137183
		, headSha: phpWasmGenericRecordSparseCheckoutRepairPredecessor
		, jobName: "PHP-Wasm corpus (refinements)"
	});
	assert.equal(history.failure
		, "generic-record archive replay failed with ENOENT");
	assert.deepEqual(history.missingFiles, ["receipt.json", "ordinary.json"]);
});

test("PHP-Wasm sparse repair retains its complete four-file archive", async () => {
	const history = await record();
	const workflow = git(["show"
		, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:.github/workflows/consumer-matrix.yml`]);
	const regression = git(["show"
		, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:tests/docker-consumer-ci.test.mjs`]);
	assertPhpWasmGenericRecordSparseCheckoutRepair(workflow, regression);
	assert.equal(history.repair.addedSparsePath
		, "/docs/evidence/php-wasm-generic-records-20261007/");
	assert.deepEqual(history.repair.selectedFiles.map(file => file.path), [
		"fin-reserved-name-failure.tap", "ordinary.json", "ordinary.tap"
		, "receipt.json"
	]);
	for(const file of history.repair.selectedFiles)
	{
		const source = git(["show"
			, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:docs/evidence/php-wasm-generic-records-20261007/${file.path}`]);
		assert.equal(Buffer.byteLength(source), file.bytes, file.path);
		assert.equal(sha256(source), file.sha256, file.path);
	}
	assert.deepEqual({
		selectedBytes: history.repair.selectedBytes
		, observedMaterializedKiB: history.repair.observedMaterializedKiB
	}, { selectedBytes: 250321, observedMaterializedKiB: 256 });
	assert.equal(history.repair.regressionOwnsConsumer, true);
});

test("PHP-Wasm sparse repair changes only 92 workflow pins", async () => {
	const history = await record();
	assert.deepEqual(history.workflowPin, {
		path: ".github/workflows/consumer-matrix.yml", count: 92
		, previous: "83d38737fa631ff9fbbd5b6079ca0b62a986bf703c8313df825043610ea098c2"
		, current: "ba0f065731e8be2ceb8ba01dd046eef8ed8b381e61ca8b5bd82b12ced4e853d1"
	});
	const before = git(["show"
		, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:docs/type-surface.v1.json`]);
	const after = git(["show"
		, `${phpWasmGenericRecordSparseCheckoutRepairPinRepair}:docs/type-surface.v1.json`]);
	assert.equal(after.split(history.workflowPin.current).length - 1, 92);
	assert.equal(after.replaceAll(
		history.workflowPin.current, history.workflowPin.previous), before);
	assert.deepEqual(history.exactModel, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	});
	assert.equal(history.changedSupportCells, 0);
	assert.equal(history.runtimeSemanticChanges, 0);
});

test("PHP-Wasm sparse repair reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, phpWasmGenericRecordSparseCheckoutRepairImplementationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				phpWasmGenericRecordSparseCheckoutRepairImplementation
				, update.path), update), true, update.path);
		assert.deepEqual(history.pinUpdates.map(update => update.path)
			, phpWasmGenericRecordSparseCheckoutRepairPinPaths);
		for(const update of history.pinUpdates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				phpWasmGenericRecordSparseCheckoutRepairPinRepair
				, update.path), update), true, update.path);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${phpWasmGenericRecordSparseCheckoutRepairPinRepair}:${
					update.path}`]);
			assert.equal(reversePhpWasmGenericRecordSparseCheckoutRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforePhpWasmGenericRecordSparseCheckoutRepairSource(
				update.path, current, update.previousSha256)
				, previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256)
				, previous, update.path);
		}
		for(const path of [
			...phpWasmGenericRecordSparseCheckoutRepairImplementationPaths
			, ...phpWasmGenericRecordSparseCheckoutRepairPinPaths
			, ...phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("PHP-Wasm sparse repair rejects forgeries and another writer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, phpWasmGenericRecordSparseCheckoutRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:${
				update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reversePhpWasmGenericRecordSparseCheckoutRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-php-wasm-generic-record-sparse-checkout-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
