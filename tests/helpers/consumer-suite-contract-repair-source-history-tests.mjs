/**
 * Authenticate the sparse consumer-suite and JVM HostNull contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	assertConsumerSuiteContractRepair
	, beforeConsumerSuiteContractRepairSource
	, consumerSuiteContractRepairHistoryAdditions
	, consumerSuiteContractRepairHistoryPath
	, consumerSuiteContractRepairImplementation
	, consumerSuiteContractRepairImplementationAdditions
	, consumerSuiteContractRepairImplementationPaths
	, consumerSuiteContractRepairIntegrationPaths
	, consumerSuiteContractRepairModifiedPaths
	, consumerSuiteContractRepairNormalizationPaths
	, consumerSuiteContractRepairPredecessor
	, reverseConsumerSuiteContractRepairUpdate
} from "./consumer-suite-contract-repair-source-history.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { beforeCurrentJvmConsumerRepair }
	from "./jvm-source-history.mjs";
import {
	sourceAtFinHistoryMilestone, sourceAtFinHistoryRecordSource
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	consumerSuiteContractRepairHistoryPath, "utf8"));

test("consumer-suite repair records both discovered Downstream failures"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "consumer-suite-contract-repair-source-v1");
		assert.equal(history.predecessorCommit
			, consumerSuiteContractRepairPredecessor);
		assert.equal(history.implementationCommit
			, consumerSuiteContractRepairImplementation);
		assert.deepEqual(history.discovery, [
			{
				run: 41288729186, job: 124801897251
				, lane: "Node and browser npm consumers"
				, failure: "retained Scalar Fin evidence was absent from the bounded sparse consumer checkout"
			}
			, {
				run: 41288729186, job: 124801897579
				, lane: "Managed consumer (jvm)"
				, failure: "the legacy compound caller expected generic wrapper construction to reject null"
			}
		]);
		assert.equal(history.changedSupportCells, 0);
		assert.equal(history.runtimeSemanticChanges, 0);
		assert.equal(history.livePinRefreshes, 20);
		assert.deepEqual(history.exactModel, {
			sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
			, bytes: 16916757, cells: 1054, stageEntries: 5270
		});
	}
);

test("consumer-suite repair retains runtime semantics and complete checks"
	, async () => {
		const sources = Object.fromEntries(consumerSuiteContractRepairImplementationPaths
			.map(path => [path
				, git(["show"
				, `${consumerSuiteContractRepairImplementation}:${path}`])]));
		assertConsumerSuiteContractRepair(sources);
		const history = await record();
		assert.match(history.rootCauses.sparseRegistration
			, /runtime test imported four retained-history suites/u);
		assert.match(history.rootCauses.jvmHostNull
			, /Some\(null\)/u);
		assert.match(history.repairs.sparseRegistration
			, /dedicated Core-discovered test/u);
		assert.match(history.repairs.jvmHostNull
			, /API conversion boundary/u);
	}
);

test("consumer-suite repair reverses every authenticated source", async () => {
	const history = await record();
	assert.deepEqual(history.updates.map(update => update.path)
		, consumerSuiteContractRepairModifiedPaths);
	for(const update of history.updates)
	{
		const current = git(["show"
			, `${consumerSuiteContractRepairImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${consumerSuiteContractRepairPredecessor}:${update.path}`]);
		assert.equal(reverseConsumerSuiteContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeConsumerSuiteContractRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, consumerSuiteContractRepairIntegrationPaths);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			consumerSuiteContractRepairHistoryPath, update.path
			, update.currentSha256);
		const previous = git(["show"
			, `${consumerSuiteContractRepairImplementation}:${update.path}`]);
		assert.equal(reverseConsumerSuiteContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of [
		...consumerSuiteContractRepairModifiedPaths
		, ...consumerSuiteContractRepairIntegrationPaths
	]) assert.ok(finRefinementNormalizationPaths.includes(path), path);
});

test("consumer-suite additions and current pins are exact", async () => {
	const history = await record();
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, consumerSuiteContractRepairImplementationAdditions);
	for(const addition of history.implementationAdditions)
		assert.equal(sha256(git(["show"
			, `${consumerSuiteContractRepairImplementation}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, consumerSuiteContractRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const inventoryUpdate = history.integrationUpdates.find(update =>
		update.path === "docs/type-surface.v1.json");
	assert.ok(inventoryUpdate);
	const inventory = await sourceAtFinHistoryRecordSource(
		consumerSuiteContractRepairHistoryPath, inventoryUpdate.path
		, inventoryUpdate.currentSha256);
	for(const [digest, count] of [
		["e0de69c454eca078ff6693e2f7e1d4e9413bbcfce066668397ac79348ef6d9c5", 2]
		, ["6a3eb45dbb06a627f271149e686811dd76de3931414d63a0ffce3058c37a8c24", 2]
		, ["f1e55e2b4fc44833fb78744235463725013b7a08fa7ec970d156b088396bedb1", 2]
		, ["299543a39ae61f3bdb22818db8355251d677de3b2bfb07ad6f69b2001b028c35", 1]
		, ["bf54e8155744c700efd32a4af7fc76316eba46a0ebb5c9612f66a8f2082434c1", 10]
		, ["4db71786cdb8619aaa705fd178e9df9784f95b93f8f236164ab6a82b80945c91", 3]
	]) assert.equal(inventory.split(digest).length - 1, count, digest);
});

test("consumer-suite repair preserves immutable JVM evidence", async () => {
	const history = await record();
	for(const path of [
		"tests/fixtures/compound-consumers/java.java"
		, "tests/fixtures/compound-consumers/kotlin.kt"
	]) {
		const update = history.updates.find(item => item.path === path);
		const live = await readFile(path, "utf8");
		assert.equal(sha256(beforeCurrentJvmConsumerRepair(
			path, live, update.previousSha256)), update.previousSha256, path);
	}
});

test("consumer-suite repair rejects forged history and duplicate writes"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${consumerSuiteContractRepairImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseConsumerSuiteContractRepairUpdate(current, forged));
		const copy = spawnSync(process.execPath, [
			"scripts/update-consumer-suite-contract-repair-source-history.mjs"
		], { encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(copy.stdout + copy.stderr
			, /already exists|Expected values to be strictly equal/u);
		for(const path of consumerSuiteContractRepairNormalizationPaths)
			assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);
