/**
 * Authenticate the PHP-Wasm callback-entry executed-scope trace-plan repair.
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
	beforePhpWasmCallbackEntryTracePlanRepairSource
	, phpWasmCallbackEntryTracePlanRepairAddedPaths
	, phpWasmCallbackEntryTracePlanRepairChangedPaths
	, phpWasmCallbackEntryTracePlanRepairHistoryPath
	, phpWasmCallbackEntryTracePlanRepairImplementation
	, phpWasmCallbackEntryTracePlanRepairIntegrationPaths
	, phpWasmCallbackEntryTracePlanRepairPredecessor
	, reversePhpWasmCallbackEntryTracePlanRepairUpdate
} from "./php-wasm-callback-entry-trace-plan-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback-entry trace-plan repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackEntryTracePlanRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-callback-entry-trace-plan-repair-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmCallbackEntryTracePlanRepairPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmCallbackEntryTracePlanRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmCallbackEntryTracePlanRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmCallbackEntryTracePlanRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmCallbackEntryTracePlanRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmCallbackEntryTracePlanRepairSource);
		const previous = git(["show"
			, `${phpWasmCallbackEntryTracePlanRepairPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackEntryTracePlanRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmCallbackEntryTracePlanRepairSource);
		const previous = git(["show"
			, `${phpWasmCallbackEntryTracePlanRepairImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackEntryTracePlanRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback-entry trace-plan repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmCallbackEntryTracePlanRepairImplementation}^`]).trim()
	, phpWasmCallbackEntryTracePlanRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmCallbackEntryTracePlanRepairPredecessor
		, phpWasmCallbackEntryTracePlanRepairImplementation])
		.trim().split("\n").sort()
	, [...phpWasmCallbackEntryTracePlanRepairChangedPaths].sort());
});

test("callback-entry trace-plan repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackEntryTracePlanRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforePhpWasmCallbackEntryTracePlanRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmCallbackEntryTracePlanRepairUpdate(
		current, update));
});

test("callback-entry trace-plan repair writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-callback-entry-trace-plan-history-"));
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
		"scripts/update-php-wasm-callback-entry-trace-plan-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
