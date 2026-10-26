/**
 * Prove the measured Core shard runtime-budget repair and its source boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCoreContractRuntimeBudgetSource
	, coreContractRuntimeBudgetAddedPaths
	, coreContractRuntimeBudgetHistoryPath
	, coreContractRuntimeBudgetImplementation
	, coreContractRuntimeBudgetImplementationPaths
	, coreContractRuntimeBudgetIntegrationPaths
	, coreContractRuntimeBudgetPredecessor
	, reverseCoreContractRuntimeBudgetUpdate
} from "./core-contract-runtime-budget-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { gitSourceHistoryTransition } from "./source-history-stream.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	coreContractRuntimeBudgetHistoryPath, "utf8"
));

test("Core runtime budget records its exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-contract-runtime-budget-source-v1");
	assert.equal(record.predecessorCommit
		, coreContractRuntimeBudgetPredecessor);
	assert.equal(record.implementationCommit
		, coreContractRuntimeBudgetImplementation);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreContractRuntimeBudgetImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, coreContractRuntimeBudgetIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, coreContractRuntimeBudgetAddedPaths);
	assert.equal(git(["rev-parse"
		, `${coreContractRuntimeBudgetImplementation}^`]).trim()
	, coreContractRuntimeBudgetPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreContractRuntimeBudgetPredecessor
		, coreContractRuntimeBudgetImplementation]).trim().split("\n")
	, [...coreContractRuntimeBudgetImplementationPaths].sort());
});

test("Core runtime budget reverses every authenticated source", async () => {
	const record = await read();
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		if(update.path === "docs/type-surface.v1.json")
		{
			assert.deepEqual(await gitSourceHistoryTransition(update.path
				, coreContractRuntimeBudgetPredecessor
				, coreContractRuntimeBudgetImplementation), update);
			continue;
		}
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreContractRuntimeBudgetSource);
		const prior = record.integrationUpdates.includes(update)
			? coreContractRuntimeBudgetImplementation
			: coreContractRuntimeBudgetPredecessor;
		const previous = git(["show", `${prior}:${update.path}`]);
		assert.equal(reverseCoreContractRuntimeBudgetUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Core runtime budget preserves coverage and raises only measured headroom", async () => {
	const workflow = await readFile(".github/workflows/quality.yml", "utf8");
	assert.match(workflow, /timeout-minutes: 240/u);
	assert.match(workflow, /max-parallel: 6/u);
	assert.match(workflow
		, /shard: \[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12\]/u);
	const record = await read();
	const inventory = record.updates.find(update =>
		update.path === "docs/type-surface.v1.json");
	assert.ok(inventory);
	assert.equal(inventory.edits.length, 1);
	const previous = sha256(git(["show"
		, `${coreContractRuntimeBudgetPredecessor}:.github/workflows/quality.yml`]));
	const current = sha256(git(["show"
		, `${coreContractRuntimeBudgetImplementation}:.github/workflows/quality.yml`]));
	assert.equal(inventory.edits[0].previous
		, `          "sha256": "${previous}"\n`);
	assert.equal(inventory.edits[0].current
		, `          "sha256": "${current}"\n`);
});

test("Core runtime budget rejects unknown and altered transitions", async () => {
	const update = (await read()).updates.find(item =>
		item.path !== "docs/type-surface.v1.json");
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCoreContractRuntimeBudgetSource);
	for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCoreContractRuntimeBudgetUpdate(
			current, forged));
	assert.equal(beforeCoreContractRuntimeBudgetSource(
		update.path, current + "unknown"), current + "unknown");
	assert.equal(beforeCoreContractRuntimeBudgetSource(
		"unrelated.mjs", current), current);
});

test("Core runtime-budget writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-runtime-budget-history-guard-"
	));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-contract-runtime-budget-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
