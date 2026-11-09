/**
 * Verify the producer-contract current live-source pin repair and seal.
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
	assertVo1220ProducerContractLivePinRepair
	, beforeVo1220ProducerContractLivePinRepairSource
	, reverseVo1220ProducerContractLivePinRepairUpdate
	, vo1220ProducerContractLivePinRepairBehavior
	, vo1220ProducerContractLivePinRepairHistoryAdditions
	, vo1220ProducerContractLivePinRepairHistoryPath
	, vo1220ProducerContractLivePinRepairImplementation
	, vo1220ProducerContractLivePinRepairImplementationPaths
	, vo1220ProducerContractLivePinRepairIntegrationPaths
	, vo1220ProducerContractLivePinRepairNormalizationPaths
	, vo1220ProducerContractLivePinRepairPredecessor
} from "./vo1220-producer-contract-live-pin-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220ProducerContractLivePinRepairHistoryPath, "utf8"
));

test("producer-contract live-pin repair authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-producer-contract-live-pin-repair-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220ProducerContractLivePinRepairPredecessor);
	assert.equal(value.implementationCommit
		, vo1220ProducerContractLivePinRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220ProducerContractLivePinRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220ProducerContractLivePinRepairIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220ProducerContractLivePinRepairHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of value.updates)
	{
		const current = blob(vo1220ProducerContractLivePinRepairImplementation
			, update.path);
		const previous = blob(vo1220ProducerContractLivePinRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220ProducerContractLivePinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(vo1220ProducerContractLivePinRepairImplementation
			, update.path);
		assert.equal(reverseVo1220ProducerContractLivePinRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("producer-contract live-pin repair changes only four citations", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220ProducerContractLivePinRepairBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.measurementSemanticChanges, 0);
	assert.equal(value.behavior.testContractChanges, 0);
	assert.equal(value.behavior.changedSourcePaths, 1);
	assert.equal(value.behavior.refreshedCitations, 4);
	assert.equal(value.behavior.staleCitations, 0);
	assert.deepEqual(value.currentSourcePins, [{
		path: "tests/hosted-container-inventory.test.mjs", citations: 4
	}]);
	assert.equal(value.exactModelSha256.before, value.exactModelSha256.after);
	const sources = Object.fromEntries(
		vo1220ProducerContractLivePinRepairImplementationPaths.map(path => [
			path, blob(vo1220ProducerContractLivePinRepairImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220ProducerContractLivePinRepair(sources)
		, vo1220ProducerContractLivePinRepairBehavior);
});

test("producer-contract live-pin repair rejects unknown transitions", async () => {
	const update = (await read()).updates[0];
	const current = blob(vo1220ProducerContractLivePinRepairImplementation
		, update.path);
	assert.equal(beforeVo1220ProducerContractLivePinRepairSource(
		update.path, current, update.currentSha256), current);
	assert.equal(beforeVo1220ProducerContractLivePinRepairSource(
		update.path, `${current}unknown`), `${current}unknown`);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
		assert.throws(() => reverseVo1220ProducerContractLivePinRepairUpdate(
			current, forged));
	assert.ok(vo1220ProducerContractLivePinRepairNormalizationPaths
		.includes(update.path));
});

test("producer-contract live-pin writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-producer-pin-guard-`);
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
		"scripts/update-vo1220-producer-contract-live-pin-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
