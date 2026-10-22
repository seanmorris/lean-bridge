/**
 * Authenticate the PHP-Wasm refinement-entry generator closure.
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
	beforePhpWasmRefinementEntryGeneratorClosureSource
	, phpWasmRefinementEntryGeneratorClosureAddedPaths
	, phpWasmRefinementEntryGeneratorClosureHistoryPath
	, phpWasmRefinementEntryGeneratorClosureImplementation
	, phpWasmRefinementEntryGeneratorClosureImplementationPaths
	, phpWasmRefinementEntryGeneratorClosureIntegrationPaths
	, phpWasmRefinementEntryGeneratorClosureModifiedPaths
	, phpWasmRefinementEntryGeneratorClosurePredecessor
	, reversePhpWasmRefinementEntryGeneratorClosureUpdate
} from "./php-wasm-refinement-entry-generator-closure-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm refinement-entry generator closure restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryGeneratorClosureHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "php-wasm-refinement-entry-generator-closure-v1");
	assert.equal(record.predecessorCommit
		, phpWasmRefinementEntryGeneratorClosurePredecessor);
	assert.equal(record.implementationCommit
		, phpWasmRefinementEntryGeneratorClosureImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmRefinementEntryGeneratorClosureModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, phpWasmRefinementEntryGeneratorClosureIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmRefinementEntryGeneratorClosureAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmRefinementEntryGeneratorClosureSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryGeneratorClosurePredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryGeneratorClosureUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforePhpWasmRefinementEntryGeneratorClosureSource);
		const previous = git(["show"
			, `${phpWasmRefinementEntryGeneratorClosureImplementation}:${update.path}`]);
		assert.equal(reversePhpWasmRefinementEntryGeneratorClosureUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("PHP-Wasm refinement-entry generator closure range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmRefinementEntryGeneratorClosureImplementation}^`]).trim()
	, phpWasmRefinementEntryGeneratorClosurePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmRefinementEntryGeneratorClosurePredecessor
		, phpWasmRefinementEntryGeneratorClosureImplementation]).trim().split("\n").sort()
	, [...phpWasmRefinementEntryGeneratorClosureImplementationPaths].sort());
});

test("PHP-Wasm refinement-entry generator closure rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		phpWasmRefinementEntryGeneratorClosureHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforePhpWasmRefinementEntryGeneratorClosureSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reversePhpWasmRefinementEntryGeneratorClosureUpdate(current, update));
});

test("PHP-Wasm refinement-entry generator writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-php-wasm-entry-generator-history-"));
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
		"scripts/update-php-wasm-refinement-entry-generator-closure-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
