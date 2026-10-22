/**
 * Authenticate dependent/indexed PHP-Wasm entry-measurement source history.
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
	beforePhpWasmIndexedRefinementEntrySource
	, phpWasmIndexedRefinementEntryAddedPaths
	, phpWasmIndexedRefinementEntryChangedPaths
	, phpWasmIndexedRefinementEntryHistoryPath
	, phpWasmIndexedRefinementEntryImplementation
	, phpWasmIndexedRefinementEntryImplementationPaths
	, phpWasmIndexedRefinementEntryPredecessor
	, reversePhpWasmIndexedRefinementEntryUpdate
} from "./php-wasm-indexed-refinement-entry-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("indexed PHP-Wasm entry history restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmIndexedRefinementEntryHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-indexed-refinement-entry-v1");
	assert.equal(record.predecessorCommit, phpWasmIndexedRefinementEntryPredecessor);
	assert.equal(record.implementationCommit, phpWasmIndexedRefinementEntryImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmIndexedRefinementEntryChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmIndexedRefinementEntryAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmIndexedRefinementEntrySource);
		const previous = git(["show"
			, `${phpWasmIndexedRefinementEntryPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmIndexedRefinementEntryUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmIndexedRefinementEntrySource(update.path, current)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("indexed PHP-Wasm entry implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmIndexedRefinementEntryImplementation}^`]).trim()
	, phpWasmIndexedRefinementEntryPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmIndexedRefinementEntryPredecessor
		, phpWasmIndexedRefinementEntryImplementation]).trim().split("\n").sort()
	, [...phpWasmIndexedRefinementEntryImplementationPaths].sort());
});

test("indexed PHP-Wasm entry history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		phpWasmIndexedRefinementEntryHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmIndexedRefinementEntrySource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmIndexedRefinementEntryUpdate(current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmIndexedRefinementEntryUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmIndexedRefinementEntryUpdate(current, unknown));
	assert.equal(beforePhpWasmIndexedRefinementEntrySource(update.path, `${current}\n`)
		, `${current}\n`);
});

test("indexed PHP-Wasm entry history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-indexed-php-wasm-entry-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-indexed-refinement-entry-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
