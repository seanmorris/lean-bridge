/**
 * Verify the native-budget lint-contract repair and source-history seal.
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
	assertVo1220NativeBudgetLintContractRepair
	, beforeVo1220NativeBudgetLintContractRepairSource
	, reverseVo1220NativeBudgetLintContractRepairUpdate
	, vo1220NativeBudgetLintContractRepairBehavior
	, vo1220NativeBudgetLintContractRepairHistoryAdditions
	, vo1220NativeBudgetLintContractRepairHistoryPath
	, vo1220NativeBudgetLintContractRepairImplementation
	, vo1220NativeBudgetLintContractRepairImplementationPaths
	, vo1220NativeBudgetLintContractRepairIntegrationPaths
	, vo1220NativeBudgetLintContractRepairNormalizationPaths
	, vo1220NativeBudgetLintContractRepairPredecessor
} from "./vo1220-native-budget-lint-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const blob = (commit, path) => git(["show", `${commit}:${path}`]);
const read = async () => JSON.parse(await readFile(
	vo1220NativeBudgetLintContractRepairHistoryPath, "utf8"
));

test("native-budget lint repair authenticates every transition", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "vo1220-native-budget-lint-contract-repair-source-v1");
	assert.equal(value.predecessorCommit
		, vo1220NativeBudgetLintContractRepairPredecessor);
	assert.equal(value.implementationCommit
		, vo1220NativeBudgetLintContractRepairImplementation);
	assert.deepEqual(value.updates.map(update => update.path)
		, vo1220NativeBudgetLintContractRepairImplementationPaths);
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, vo1220NativeBudgetLintContractRepairIntegrationPaths);
	assert.deepEqual(value.historyAdditions.map(addition => addition.path)
		, vo1220NativeBudgetLintContractRepairHistoryAdditions);
	for(const addition of value.historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	for(const update of value.updates)
	{
		const current = blob(vo1220NativeBudgetLintContractRepairImplementation
			, update.path);
		const previous = blob(vo1220NativeBudgetLintContractRepairPredecessor
			, update.path);
		assert.equal(reverseVo1220NativeBudgetLintContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = blob(vo1220NativeBudgetLintContractRepairImplementation
			, update.path);
		assert.equal(reverseVo1220NativeBudgetLintContractRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("native-budget lint repair changes no behavior, support or inventory", async () => {
	const value = await read();
	assert.deepEqual(value.behavior
		, vo1220NativeBudgetLintContractRepairBehavior);
	assert.equal(value.changedSupportCells, 0);
	assert.equal(value.runtimeSemanticChanges, 0);
	assert.deepEqual(value.currentSourcePins, []);
	assert.equal(value.inventorySha256.before, value.inventorySha256.after);
	const sources = Object.fromEntries(
		vo1220NativeBudgetLintContractRepairImplementationPaths.map(path => [
			path, blob(vo1220NativeBudgetLintContractRepairImplementation, path)
		])
	);
	assert.deepEqual(assertVo1220NativeBudgetLintContractRepair(sources)
		, vo1220NativeBudgetLintContractRepairBehavior);
	assert.equal(blob(vo1220NativeBudgetLintContractRepairPredecessor
		, "docs/evidence/vo1220-exact-type-surface-v1.json")
		, blob(vo1220NativeBudgetLintContractRepairImplementation
			, "docs/evidence/vo1220-exact-type-surface-v1.json"));
});

test("native-budget lint repair rejects unknown and forged transitions"
	, async () => {
		const update = (await read()).updates[0];
		const current = blob(vo1220NativeBudgetLintContractRepairImplementation
			, update.path);
		assert.equal(beforeVo1220NativeBudgetLintContractRepairSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeVo1220NativeBudgetLintContractRepairSource(
			update.path, current + "unknown"), current + "unknown");
		for(const forged of [{ ...update, previousSha256: "0".repeat(64) }
			, { ...update, edits: [] }, { ...update, path: "unrelated.mjs" }])
			assert.throws(() =>
				reverseVo1220NativeBudgetLintContractRepairUpdate(
					current, forged));
		assert.ok(vo1220NativeBudgetLintContractRepairNormalizationPaths
			.includes(update.path));
	}
);

test("native-budget lint-repair writer refuses another checkout", async t => {
	const root = await mkdtemp(`${tmpdir()}/lean-native-budget-lint-guard-`);
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
		"scripts/update-vo1220-native-budget-lint-contract-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /Expected values to be strictly equal/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
