/**
 * Authenticate the PHP-Wasm entry flat-position plan.
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
	beforePhpWasmEntryFlatPositionSource
	, phpWasmEntryFlatPositionAddedPaths
	, phpWasmEntryFlatPositionChangedPaths
	, phpWasmEntryFlatPositionHistoryPath
	, phpWasmEntryFlatPositionImplementation
	, phpWasmEntryFlatPositionIntegrationPaths
	, phpWasmEntryFlatPositionPredecessor
	, reversePhpWasmEntryFlatPositionUpdate
} from "./php-wasm-entry-flat-position-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm entry flat-position history restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmEntryFlatPositionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-entry-flat-position-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmEntryFlatPositionPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmEntryFlatPositionImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryFlatPositionChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryFlatPositionIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryFlatPositionAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmEntryFlatPositionSource);
		const previous = git(["show"
			, `${phpWasmEntryFlatPositionPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmEntryFlatPositionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmEntryFlatPositionSource);
		const previous = git(["show"
			, `${phpWasmEntryFlatPositionImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmEntryFlatPositionUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm entry flat-position plan is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmEntryFlatPositionImplementation}^`]).trim()
	, phpWasmEntryFlatPositionPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryFlatPositionPredecessor
		, phpWasmEntryFlatPositionImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...phpWasmEntryFlatPositionChangedPaths].sort());
});

test("PHP-Wasm entry flat-position history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		phpWasmEntryFlatPositionHistoryPath, "utf8"));
	for(const original of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(original.path
			, original.currentSha256
			, beforePhpWasmEntryFlatPositionSource);
		const update = structuredClone(original);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reversePhpWasmEntryFlatPositionUpdate(
			current, update), original.path);
	}
});

test("PHP-Wasm entry flat-position writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-entry-flat-position-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-entry-flat-position-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
