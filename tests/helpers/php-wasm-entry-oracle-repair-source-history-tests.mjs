/**
 * Authenticate the post-closure PHP-Wasm entry-oracle repairs.
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
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforePhpWasmEntryOracleRepairSource
	, reversePhpWasmEntryOracleRepairUpdate
	, phpWasmEntryOracleRepairAddedPaths
	, phpWasmEntryOracleRepairHistoryPath
	, phpWasmEntryOracleRepairImplementation
	, phpWasmEntryOracleRepairImplementationCommits
	, phpWasmEntryOracleRepairIntegrationPaths
	, phpWasmEntryOracleRepairModifiedPaths
	, phpWasmEntryOracleRepairPredecessor
} from "./php-wasm-entry-oracle-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm entry-oracle repairs restore every source", async () => {
	const record = JSON.parse(await readFile(phpWasmEntryOracleRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-entry-oracle-repair-source-v1");
	assert.equal(record.predecessorCommit, phpWasmEntryOracleRepairPredecessor);
	assert.equal(record.implementationCommit, phpWasmEntryOracleRepairImplementation);
	assert.deepEqual(record.implementationCommits, phpWasmEntryOracleRepairImplementationCommits);
	assert.deepEqual(record.updates.map(item => item.path), phpWasmEntryOracleRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path), phpWasmEntryOracleRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path), phpWasmEntryOracleRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryOracleRepairSource);
		const previous = git(["show", `${phpWasmEntryOracleRepairPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmEntryOracleRepairUpdate(current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmEntryOracleRepairSource);
		const previous = git(["show", `${phpWasmEntryOracleRepairImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmEntryOracleRepairUpdate(current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("PHP-Wasm entry-oracle repair range is exact", () => {
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${phpWasmEntryOracleRepairPredecessor}..${phpWasmEntryOracleRepairImplementation}`])
		.trim().split("\n"), phpWasmEntryOracleRepairImplementationCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryOracleRepairPredecessor
		, phpWasmEntryOracleRepairImplementation
	])
		.trim().split("\n").sort(), [...phpWasmEntryOracleRepairModifiedPaths].sort());
});

test("PHP-Wasm entry-oracle repairs reject alteration", async () => {
	const record = JSON.parse(await readFile(phpWasmEntryOracleRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmEntryOracleRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmEntryOracleRepairUpdate(current, update));
});

test("PHP-Wasm entry-oracle repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-entry-oracle-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"
	]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-entry-oracle-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
