/**
 * Authenticate the explicit PHP-Wasm mixed Fin callback entry coverage.
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
	beforePhpWasmCallbackFinMixedEntrySource
	, phpWasmCallbackFinMixedEntryAddedPaths
	, phpWasmCallbackFinMixedEntryChangedPaths
	, phpWasmCallbackFinMixedEntryHistoryPath
	, phpWasmCallbackFinMixedEntryImplementation
	, phpWasmCallbackFinMixedEntryIntegrationBase
	, phpWasmCallbackFinMixedEntryIntegrationPaths
	, phpWasmCallbackFinMixedEntryPredecessor
	, reversePhpWasmCallbackFinMixedEntryUpdate
} from "./php-wasm-callback-fin-mixed-entry-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm mixed Fin callback entry coverage restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackFinMixedEntryHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-callback-fin-mixed-entry-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmCallbackFinMixedEntryPredecessor);
	assert.equal(record.implementationCommit
		, phpWasmCallbackFinMixedEntryImplementation);
	assert.equal(record.integrationBaseCommit
		, phpWasmCallbackFinMixedEntryIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmCallbackFinMixedEntryChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmCallbackFinMixedEntryIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmCallbackFinMixedEntryAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmCallbackFinMixedEntrySource);
		const previous = git(["show"
			, `${phpWasmCallbackFinMixedEntryPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackFinMixedEntryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmCallbackFinMixedEntrySource);
		const previous = git(["show"
			, `${phpWasmCallbackFinMixedEntryIntegrationBase}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackFinMixedEntryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm mixed Fin callback entry coverage is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmCallbackFinMixedEntryImplementation}^`]).trim()
	, phpWasmCallbackFinMixedEntryPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmCallbackFinMixedEntryPredecessor
		, phpWasmCallbackFinMixedEntryImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...phpWasmCallbackFinMixedEntryChangedPaths].sort());
});

test("PHP-Wasm mixed Fin callback entry coverage rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		phpWasmCallbackFinMixedEntryHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforePhpWasmCallbackFinMixedEntrySource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmCallbackFinMixedEntryUpdate(
		current, update));
});

test("PHP-Wasm mixed Fin callback entry writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-callback-fin-mixed-entry-history-"));
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
		"scripts/update-php-wasm-callback-fin-mixed-entry-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
