/**
 * Authenticate the residual-Core ledger pointer replay repair.
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
	beforeCoreResidualLedgerPointerReplayRepairSource
	, coreResidualLedgerPointerReplayRepairAddedPaths
	, coreResidualLedgerPointerReplayRepairChangedPaths
	, coreResidualLedgerPointerReplayRepairHistoryPath
	, coreResidualLedgerPointerReplayRepairImplementation
	, coreResidualLedgerPointerReplayRepairIntegrationPaths
	, coreResidualLedgerPointerReplayRepairPredecessor
	, reverseCoreResidualLedgerPointerReplayRepairUpdate
} from "./core-residual-ledger-pointer-replay-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("residual-Core ledger pointer replay repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		coreResidualLedgerPointerReplayRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-residual-ledger-pointer-replay-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreResidualLedgerPointerReplayRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreResidualLedgerPointerReplayRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreResidualLedgerPointerReplayRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreResidualLedgerPointerReplayRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreResidualLedgerPointerReplayRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCoreResidualLedgerPointerReplayRepairSource);
		const previous = git(["show"
			, `${coreResidualLedgerPointerReplayRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCoreResidualLedgerPointerReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCoreResidualLedgerPointerReplayRepairSource);
		const previous = git(["show"
			, `${coreResidualLedgerPointerReplayRepairImplementation}:${update.path}`]);
		assert.equal(reverseCoreResidualLedgerPointerReplayRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("residual-Core ledger pointer replay repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${coreResidualLedgerPointerReplayRepairImplementation}^`]).trim()
	, coreResidualLedgerPointerReplayRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreResidualLedgerPointerReplayRepairPredecessor
		, coreResidualLedgerPointerReplayRepairImplementation])
		.trim().split("\n").sort()
	, [...coreResidualLedgerPointerReplayRepairChangedPaths].sort());
});

test("residual-Core ledger pointer replay repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		coreResidualLedgerPointerReplayRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCoreResidualLedgerPointerReplayRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCoreResidualLedgerPointerReplayRepairUpdate(
		current, update));
});

test("residual-Core ledger pointer replay writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-residual-ledger-pointer-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-residual-ledger-pointer-replay-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
