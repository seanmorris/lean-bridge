/**
 * Authenticate the explicit PHP-Wasm callback tiles trace repair.
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
import {
	beforePhpWasmCallbackTilesTraceRepairSource
	, phpWasmCallbackTilesTraceRepairAddedPaths
	, phpWasmCallbackTilesTraceRepairChangedPaths
	, phpWasmCallbackTilesTraceRepairHistoryPath
	, phpWasmCallbackTilesTraceRepairImplementation
	, phpWasmCallbackTilesTraceRepairIntegrationBase
	, phpWasmCallbackTilesTraceRepairIntegrationPaths
	, phpWasmCallbackTilesTraceRepairPredecessor
	, reversePhpWasmCallbackTilesTraceRepairUpdate
} from "./php-wasm-callback-tiles-trace-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm callback tiles trace repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackTilesTraceRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-callback-tiles-trace-repair-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmCallbackTilesTraceRepairPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmCallbackTilesTraceRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, phpWasmCallbackTilesTraceRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmCallbackTilesTraceRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmCallbackTilesTraceRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmCallbackTilesTraceRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmCallbackTilesTraceRepairSource);
		const previous = git(["show"
			, `${phpWasmCallbackTilesTraceRepairPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackTilesTraceRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforePhpWasmCallbackTilesTraceRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforePhpWasmCallbackTilesTraceRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforePhpWasmCallbackTilesTraceRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmCallbackTilesTraceRepairSource);
		const previous = git(["show"
			, `${phpWasmCallbackTilesTraceRepairIntegrationBase}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackTilesTraceRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforePhpWasmCallbackTilesTraceRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforePhpWasmCallbackTilesTraceRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforePhpWasmCallbackTilesTraceRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm callback tiles trace repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmCallbackTilesTraceRepairImplementation}^`]).trim()
	, phpWasmCallbackTilesTraceRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmCallbackTilesTraceRepairPredecessor
		, phpWasmCallbackTilesTraceRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...phpWasmCallbackTilesTraceRepairChangedPaths].sort());
});

test("PHP-Wasm callback tiles trace repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackTilesTraceRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforePhpWasmCallbackTilesTraceRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmCallbackTilesTraceRepairUpdate(
		current, update));
});

test("PHP-Wasm callback tiles trace writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-callback-tiles-trace-repair-history-"));
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
		"scripts/update-php-wasm-callback-tiles-trace-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
