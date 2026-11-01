/**
 * Authenticate the reviewed-specialization sparse-suite separation repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertReviewedSpecializationSparseSuiteRepair
	, beforeReviewedSpecializationSparseSuiteRepairSource
	, reverseReviewedSpecializationSparseSuiteRepairUpdate
	, reviewedSpecializationSparseSuiteRepairHistoryAdditions
	, reviewedSpecializationSparseSuiteRepairHistoryPath
	, reviewedSpecializationSparseSuiteRepairImplementation
	, reviewedSpecializationSparseSuiteRepairImplementationPaths
	, reviewedSpecializationSparseSuiteRepairIntegrationPaths
	, reviewedSpecializationSparseSuiteRepairNormalizationPaths
	, reviewedSpecializationSparseSuiteRepairPredecessor
} from "./reviewed-specialization-sparse-suite-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	reviewedSpecializationSparseSuiteRepairHistoryPath, "utf8"));

test("reviewed-specialization sparse repair records the exact Downstream failure"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "reviewed-specialization-sparse-suite-repair-source-v1");
		assert.equal(history.predecessorCommit
			, reviewedSpecializationSparseSuiteRepairPredecessor);
		assert.equal(history.implementationCommit
			, reviewedSpecializationSparseSuiteRepairImplementation);
		assert.deepEqual(history.discovery, {
			workflow: 41303296188, job: 124844426391
			, lane: "Native consumer (c-family)"
			, failure: "the sparse runtime suite imported retained reviewed-specialization evidence that was intentionally absent from the consumer checkout"
		});
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 0);
		assert.equal(history.livePinRefreshes, 6);
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("reviewed-specialization sparse repair preserves both contracts", () => {
	const sources = {};
	for(const path of reviewedSpecializationSparseSuiteRepairImplementationPaths)
		sources[path] = git(["show"
			, `${reviewedSpecializationSparseSuiteRepairImplementation}:${path}`]);
	assertReviewedSpecializationSparseSuiteRepair(sources);
	const workflow = git(["show"
		, `${reviewedSpecializationSparseSuiteRepairImplementation}:.github/workflows/consumer-matrix.yml`]);
	assert.match(workflow
		, /node --test --test-concurrency=1 tests\/reviewed-specializations[.]test[.]mjs/u);
	const sparse = workflow.match(
		/^ {2}LEAN_BRIDGE_CONSUMER_SPARSE_CHECKOUT: \|\n((?: {4}.*\n)+)/mu)?.[1];
	assert.ok(sparse);
	assert.doesNotMatch(sparse, /reviewed-specializations-20261008/u);
});

test("reviewed-specialization sparse repair reverses every authenticated source"
	, async () => {
		const history = await record();
		assert.deepEqual(history.updates.map(update => update.path)
			, reviewedSpecializationSparseSuiteRepairImplementationPaths);
		for(const update of history.updates)
		{
			const current = git(["show"
				, `${reviewedSpecializationSparseSuiteRepairImplementation}:${update.path}`]);
			const previous = git(["show"
				, `${reviewedSpecializationSparseSuiteRepairPredecessor}:${update.path}`]);
			assert.equal(reverseReviewedSpecializationSparseSuiteRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeReviewedSpecializationSparseSuiteRepairSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
		assert.deepEqual(history.integrationUpdates.map(update => update.path)
			, reviewedSpecializationSparseSuiteRepairIntegrationPaths);
		for(const update of history.integrationUpdates)
		{
			const current = await sourceAtFinHistoryRecordSource(
				reviewedSpecializationSparseSuiteRepairHistoryPath, update.path
				, update.currentSha256);
			const previous = git(["show"
				, `${reviewedSpecializationSparseSuiteRepairImplementation}:${update.path}`]);
			assert.equal(reverseReviewedSpecializationSparseSuiteRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
		}
	}
);

test("reviewed-specialization sparse repair refreshes only six live pins"
	, async () => {
		const history = await record();
		assert.deepEqual(history.currentSourcePins, [
			{
				path: "tests/helpers/reviewed-api-promotion-tests.mjs", count: 4
				, previous: "15660aff35ece75f78af32fdc299d98076adadf0e715c53169448fe79802d147"
				, current: "6d3f726045ed2031806fcfacc4775edb7f16ef08e15330c43408719aa558c98e"
			}
			, {
				path: "tests/reviewed-specializations.test.mjs", count: 2
				, previous: "3cbcb36881906b9941633223e8ae2ae051fa430fc0ed93d854d9485e3eae53a8"
				, current: "78d93ca85fee348cb2f05b0a85d525219ff170c14a5bcc00574ee6abbceeb2d1"
			}
		]);
		const inventory = await readFile("docs/type-surface.v1.json", "utf8");
		for(const pin of history.currentSourcePins)
		{
			assert.equal(inventory.split(pin.previous).length - 1, 0, pin.path);
			assert.equal(inventory.split(pin.current).length - 1
				, pin.count, pin.path);
		}
	}
);

test("reviewed-specialization sparse repair additions are immutable"
	, async () => {
		const history = await record();
		assert.deepEqual(history.historyAdditions.map(item => item.path)
			, reviewedSpecializationSparseSuiteRepairHistoryAdditions);
		for(const addition of history.historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
		for(const path of reviewedSpecializationSparseSuiteRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("reviewed-specialization sparse repair rejects forged history and rewrites"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${reviewedSpecializationSparseSuiteRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseReviewedSpecializationSparseSuiteRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-reviewed-specialization-sparse-suite-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
	}
);
