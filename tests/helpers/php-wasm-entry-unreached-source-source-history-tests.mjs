/**
 * Authenticate the PHP-Wasm entry unreached-source classification.
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
	beforePhpWasmEntryUnreachedSourceSource
	, phpWasmEntryUnreachedSourceAddedPaths
	, phpWasmEntryUnreachedSourceChangedPaths
	, phpWasmEntryUnreachedSourceHistoryPath
	, phpWasmEntryUnreachedSourceImplementation
	, phpWasmEntryUnreachedSourceIntegrationPaths
	, phpWasmEntryUnreachedSourcePredecessor
	, reversePhpWasmEntryUnreachedSourceUpdate
} from "./php-wasm-entry-unreached-source-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm entry unreached-source history restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmEntryUnreachedSourceHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-entry-unreached-source-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmEntryUnreachedSourcePredecessor);
	assert.equal(record.implementationCommit
		, phpWasmEntryUnreachedSourceImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryUnreachedSourceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryUnreachedSourceIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryUnreachedSourceAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmEntryUnreachedSourceSource);
		const previous = git(["show"
			, `${phpWasmEntryUnreachedSourcePredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmEntryUnreachedSourceUpdate(
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
			, beforePhpWasmEntryUnreachedSourceSource);
		const previous = git(["show"
			, `${phpWasmEntryUnreachedSourceImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmEntryUnreachedSourceUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm entry unreached-source classification is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmEntryUnreachedSourceImplementation}^`]).trim()
	, phpWasmEntryUnreachedSourcePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryUnreachedSourcePredecessor
		, phpWasmEntryUnreachedSourceImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...phpWasmEntryUnreachedSourceChangedPaths].sort());
});

test("PHP-Wasm entry unreached-source history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		phpWasmEntryUnreachedSourceHistoryPath, "utf8"));
	for(const original of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(original.path
			, original.currentSha256
			, beforePhpWasmEntryUnreachedSourceSource);
		const update = structuredClone(original);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reversePhpWasmEntryUnreachedSourceUpdate(
			current, update), original.path);
	}
});

test("PHP-Wasm entry unreached-source writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-entry-unreached-source-history-"));
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
		"scripts/update-php-wasm-entry-unreached-source-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
