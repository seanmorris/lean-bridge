/**
 * Authenticate the PHP-Wasm entry-oracle closure.
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
	beforePhpWasmEntryOracleClosureSource
	, reversePhpWasmEntryOracleClosureUpdate
	, phpWasmEntryOracleClosureAddedPaths
	, phpWasmEntryOracleClosureHistoryPath
	, phpWasmEntryOracleClosureImplementation
	, phpWasmEntryOracleClosureImplementationPaths
	, phpWasmEntryOracleClosureIntegrationPaths
	, phpWasmEntryOracleClosureModifiedPaths
	, phpWasmEntryOracleClosurePredecessor
} from "./php-wasm-entry-oracle-closure-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm entry-oracle closure restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmEntryOracleClosureHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-entry-oracle-closure-source-v1");
	assert.equal(record.predecessorCommit
		, phpWasmEntryOracleClosurePredecessor);
	assert.equal(record.implementationCommit
		, phpWasmEntryOracleClosureImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmEntryOracleClosureModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmEntryOracleClosureIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmEntryOracleClosureAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmEntryOracleClosureSource);
		const previous = git(["show"
			, `${phpWasmEntryOracleClosurePredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmEntryOracleClosureUpdate(
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
			, beforePhpWasmEntryOracleClosureSource);
		const previous = git(["show"
			, `${phpWasmEntryOracleClosureImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmEntryOracleClosureUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm entry-oracle closure range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmEntryOracleClosureImplementation}^`]).trim()
	, phpWasmEntryOracleClosurePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmEntryOracleClosurePredecessor
		, phpWasmEntryOracleClosureImplementation])
		.trim().split("\n").sort()
	, [...phpWasmEntryOracleClosureImplementationPaths].sort());
});

test("PHP-Wasm entry-oracle closure rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		phpWasmEntryOracleClosureHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforePhpWasmEntryOracleClosureSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmEntryOracleClosureUpdate(
		current, update));
});

test("PHP-Wasm entry-oracle writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-entry-oracle-closure-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-entry-oracle-closure-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
