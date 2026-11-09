/**
 * Verify the producer-era Core history-budget repair and seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource, finRefinementNormalizationPaths }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	assertVo1220ProducerContractBudgetRepair
	, beforeVo1220ProducerContractBudgetRepairSource
	, reverseVo1220ProducerContractBudgetRepairUpdate
	, vo1220ProducerContractBudgetRepairBehavior
	, vo1220ProducerContractBudgetRepairHistoryAdditions
	, vo1220ProducerContractBudgetRepairHistoryPath
	, vo1220ProducerContractBudgetRepairImplementation
	, vo1220ProducerContractBudgetRepairImplementationPaths
	, vo1220ProducerContractBudgetRepairIntegrationPaths
	, vo1220ProducerContractBudgetRepairNormalizationPaths
	, vo1220ProducerContractBudgetRepairPredecessor
} from "./vo1220-producer-contract-budget-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220ProducerContractBudgetRepairHistoryPath, "utf8"
));

test("producer-contract budget repair authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-producer-contract-budget-repair-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220ProducerContractBudgetRepairPredecessor);
	assert.equal(value.implementationCommit
		, vo1220ProducerContractBudgetRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220ProducerContractBudgetRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220ProducerContractBudgetRepairIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220ProducerContractBudgetRepairHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of value.updates)
	{
		const current = blob(vo1220ProducerContractBudgetRepairImplementation
			, update.path);
		const previous = blob(vo1220ProducerContractBudgetRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220ProducerContractBudgetRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(vo1220ProducerContractBudgetRepairImplementation
			, update.path);
		assert.equal(reverseVo1220ProducerContractBudgetRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("producer-contract budget repair preserves the exact type surface", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220ProducerContractBudgetRepairBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.measurementSemanticChanges, 0);
	assert.equal(value.behavior.testContractChanges, 1);
	assert.equal(value.behavior.liveContractReaders, 12);
	assert.equal(value.behavior.producerContractReaders, 1);
	assert.equal(value.behavior.uncheckedContractReaders, 0);
	assert.deepEqual(value.currentSourcePins, []);
	assert.equal(value.inventorySha256.before, value.inventorySha256.after);
	assert.equal(value.exactModelSha256.before, value.exactModelSha256.after);
	const sources = Object.fromEntries(
		vo1220ProducerContractBudgetRepairImplementationPaths.map(path => [
			path, blob(vo1220ProducerContractBudgetRepairImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220ProducerContractBudgetRepair(sources)
		, vo1220ProducerContractBudgetRepairBehavior);
});

test("producer-contract budget repair rejects unknown transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220ProducerContractBudgetRepairImplementation
		, update.path);
	assert.equal(beforeVo1220ProducerContractBudgetRepairSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeVo1220ProducerContractBudgetRepairSource(
		update.path, `${current}unknown`), `${current}unknown`);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220ProducerContractBudgetRepairUpdate(
			current, forged));
	assert.ok(vo1220ProducerContractBudgetRepairNormalizationPaths
		.includes(update.path));
});

test("producer-contract budget writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-producer-budget-guard-`);
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-producer-contract-budget-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
