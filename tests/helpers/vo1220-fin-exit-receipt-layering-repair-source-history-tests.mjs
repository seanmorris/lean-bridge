/**
 * Verify the Fin host/JVM exit-receipt layering repair and source-history seal.
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
	assertVo1220FinExitReceiptLayeringRepair
	, beforeVo1220FinExitReceiptLayeringRepairSource
	, reverseVo1220FinExitReceiptLayeringRepairUpdate
	, vo1220FinExitReceiptLayeringRepairBehavior
	, vo1220FinExitReceiptLayeringRepairHistoryAdditions
	, vo1220FinExitReceiptLayeringRepairHistoryPath
	, vo1220FinExitReceiptLayeringRepairImplementation
	, vo1220FinExitReceiptLayeringRepairImplementationPaths
	, vo1220FinExitReceiptLayeringRepairIntegrationPaths
	, vo1220FinExitReceiptLayeringRepairNormalizationPaths
	, vo1220FinExitReceiptLayeringRepairPredecessor
} from "./vo1220-fin-exit-receipt-layering-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220FinExitReceiptLayeringRepairHistoryPath, "utf8"
));

test("Fin exit-receipt layering repair authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-fin-exit-receipt-layering-repair-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220FinExitReceiptLayeringRepairPredecessor);
	assert.equal(value.implementationCommit
		, vo1220FinExitReceiptLayeringRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220FinExitReceiptLayeringRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220FinExitReceiptLayeringRepairIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220FinExitReceiptLayeringRepairHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of value.updates)
	{
		const current = blob(vo1220FinExitReceiptLayeringRepairImplementation
			, update.path);
		const previous = blob(vo1220FinExitReceiptLayeringRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220FinExitReceiptLayeringRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(vo1220FinExitReceiptLayeringRepairImplementation
			, update.path);
		assert.equal(reverseVo1220FinExitReceiptLayeringRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("Fin exit-receipt layering repair changes only the current test contract", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220FinExitReceiptLayeringRepairBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.equal(value.behavior.measurementSemanticChanges, 0);
	assert.equal(value.behavior.testContractChanges, 1);
	assert.equal(value.behavior.exitObserverKinds, 2);
	assert.equal(value.behavior.uncheckedExitObserverKinds, 0);
	assert.deepEqual(value.currentSourcePins, []);
	assert.equal(value.inventorySha256.before, value.inventorySha256.after);
	const sources = Object.fromEntries(
		vo1220FinExitReceiptLayeringRepairImplementationPaths.map(path => [
			path, blob(vo1220FinExitReceiptLayeringRepairImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220FinExitReceiptLayeringRepair(sources)
		, vo1220FinExitReceiptLayeringRepairBehavior);
	assert.equal(blob(vo1220FinExitReceiptLayeringRepairPredecessor
		, "docs/evidence/vo1220-exact-type-surface-v1.json")
		, blob(vo1220FinExitReceiptLayeringRepairImplementation
			, "docs/evidence/vo1220-exact-type-surface-v1.json"));
});

test("Fin exit-receipt layering repair rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).updates[0];
		const current = blob(vo1220FinExitReceiptLayeringRepairImplementation
			, update.path);
		assert.equal(beforeVo1220FinExitReceiptLayeringRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220FinExitReceiptLayeringRepairSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() =>
				reverseVo1220FinExitReceiptLayeringRepairUpdate(
					current, forged));
		assert.ok(vo1220FinExitReceiptLayeringRepairNormalizationPaths
			.includes(update.path));
	}
);

test("Fin exit-receipt layering writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-fin-exit-layering-guard-`);
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
		"scripts/update-vo1220-fin-exit-receipt-layering-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
