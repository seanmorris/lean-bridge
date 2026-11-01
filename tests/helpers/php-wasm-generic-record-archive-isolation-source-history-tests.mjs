/**
 * Authenticate the job-scoped PHP-Wasm generic-record archive repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertPhpWasmGenericRecordArchiveIsolation
	, beforePhpWasmGenericRecordArchiveIsolationSource
	, phpWasmGenericRecordArchiveIsolationHistoryAdditions
	, phpWasmGenericRecordArchiveIsolationHistoryPath
	, phpWasmGenericRecordArchiveIsolationImplementation
	, phpWasmGenericRecordArchiveIsolationImplementationPaths
	, phpWasmGenericRecordArchiveIsolationIntegrationPaths
	, phpWasmGenericRecordArchiveIsolationPinPaths
	, phpWasmGenericRecordArchiveIsolationPinRepair
	, phpWasmGenericRecordArchiveIsolationPredecessor
	, reversePhpWasmGenericRecordArchiveIsolationUpdate
} from "./php-wasm-generic-record-archive-isolation-source-history.mjs";
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
	phpWasmGenericRecordArchiveIsolationHistoryPath, "utf8"));

test("PHP-Wasm archive isolation records both exact hosted failures"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "php-wasm-generic-record-archive-isolation-v1");
		assert.equal(history.predecessorCommit
			, phpWasmGenericRecordArchiveIsolationPredecessor);
		assert.equal(history.implementationCommit
			, phpWasmGenericRecordArchiveIsolationImplementation);
		assert.equal(history.pinRepairCommit
			, phpWasmGenericRecordArchiveIsolationPinRepair);
		assert.deepEqual(history.failedJobs, [
			{ workflow: 41268569577, job: 124742205648
				, headSha: phpWasmGenericRecordArchiveIsolationPredecessor
				, jobName: "Reviewed Fin Wasm entry (probe)" }
			, { workflow: 41268569577, job: 124742205749
				, headSha: phpWasmGenericRecordArchiveIsolationPredecessor
				, jobName: "Native consumer (python)" }
		]);
		assert.equal(history.failure
			, "shared source closure rejected ordinary.tap as retained payload");
	}
);

test("PHP-Wasm archive isolation preserves the global refusal and one bounded consumer"
	, async () => {
		const history = await record();
		const workflow = git(["show"
			, `${phpWasmGenericRecordArchiveIsolationImplementation}:.github/workflows/consumer-matrix.yml`]);
		const regression = git(["show"
			, `${phpWasmGenericRecordArchiveIsolationImplementation}:tests/docker-consumer-ci.test.mjs`]);
		assertPhpWasmGenericRecordArchiveIsolation(workflow, regression);
		assert.deepEqual(history.repair, {
			sharedCheckoutMetadataOnly: true
			, retainedPayloadRefusalUnchanged: true
			, materializedJob: "php-wasm-corpus"
			, materializedProfile: "refinements"
			, afterSourceClosureCheck: true
			, selectedFiles: [
				"fin-reserved-name-failure.tap", "ordinary.json"
				, "ordinary.tap", "receipt.json"
			]
			, selectedBytes: 250321
		});
	}
);

test("PHP-Wasm archive isolation changes only 92 workflow pins"
	, async () => {
		const history = await record();
		assert.deepEqual(history.workflowPin, {
			path: ".github/workflows/consumer-matrix.yml", count: 92
			, previous: "ba0f065731e8be2ceb8ba01dd046eef8ed8b381e61ca8b5bd82b12ced4e853d1"
			, current: "7e842a6dd36ee897a3defaaa40546ed7079c37ac4b85511839a947818798badd"
		});
		const before = git(["show"
			, `${phpWasmGenericRecordArchiveIsolationImplementation}:docs/type-surface.v1.json`]);
		const after = git(["show"
			, `${phpWasmGenericRecordArchiveIsolationPinRepair}:docs/type-surface.v1.json`]);
		assert.equal(after.split(history.workflowPin.current).length - 1, 92);
		assert.equal(after.replaceAll(history.workflowPin.current
			, history.workflowPin.previous), before);
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 0);
	}
);

test("PHP-Wasm archive isolation reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, phpWasmGenericRecordArchiveIsolationImplementationPaths);
		for(const update of history.updates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				phpWasmGenericRecordArchiveIsolationImplementation
					, update.path), update), true, update.path);
		assert.deepEqual(history.pinUpdates.map(update => update.path)
			, phpWasmGenericRecordArchiveIsolationPinPaths);
		for(const update of history.pinUpdates)
			assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
				phpWasmGenericRecordArchiveIsolationPinRepair
					, update.path), update), true, update.path);
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, phpWasmGenericRecordArchiveIsolationIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256);
			const previous = git(["show"
				, `${phpWasmGenericRecordArchiveIsolationPinRepair}:${update.path}`]);
			assert.equal(reversePhpWasmGenericRecordArchiveIsolationUpdate(
				current, update), previous, update.path);
			assert.equal(beforePhpWasmGenericRecordArchiveIsolationSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		for(const path of [
			...phpWasmGenericRecordArchiveIsolationImplementationPaths
			, ...phpWasmGenericRecordArchiveIsolationPinPaths
			, ...phpWasmGenericRecordArchiveIsolationIntegrationPaths
		]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("PHP-Wasm archive isolation rejects forgeries and another writer"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, phpWasmGenericRecordArchiveIsolationHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		const update = history.updates[0];
		const current = git(["show"
			, `${phpWasmGenericRecordArchiveIsolationImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reversePhpWasmGenericRecordArchiveIsolationUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-php-wasm-generic-record-archive-isolation-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
