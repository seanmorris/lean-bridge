/**
 * Authenticate owned-refinement PHP-Wasm entry measurement source history.
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
	beforePhpWasmOwnedRefinementEntrySource
	, phpWasmOwnedRefinementEntryAddedPaths
	, phpWasmOwnedRefinementEntryChangedPaths
	, phpWasmOwnedRefinementEntryHistoryPath
	, phpWasmOwnedRefinementEntryImplementation
	, phpWasmOwnedRefinementEntryImplementationPaths
	, phpWasmOwnedRefinementEntryPredecessor
	, reversePhpWasmOwnedRefinementEntryUpdate
} from "./php-wasm-owned-refinement-entry-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned-refinement entry history restores every source", async () => {
	const record = JSON.parse(await readFile(
		phpWasmOwnedRefinementEntryHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-owned-refinement-entry-v1");
	assert.equal(record.predecessorCommit, phpWasmOwnedRefinementEntryPredecessor);
	assert.equal(record.implementationCommit, phpWasmOwnedRefinementEntryImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, phpWasmOwnedRefinementEntryChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, phpWasmOwnedRefinementEntryAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmOwnedRefinementEntrySource);
		const previous = git(["show"
			, `${phpWasmOwnedRefinementEntryPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmOwnedRefinementEntryUpdate(current, update)
			, previous, update.path);
		assert.equal(beforePhpWasmOwnedRefinementEntrySource(update.path, current)
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

test("owned-refinement entry implementation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${phpWasmOwnedRefinementEntryImplementation}^`]).trim()
	, phpWasmOwnedRefinementEntryPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, phpWasmOwnedRefinementEntryPredecessor
		, phpWasmOwnedRefinementEntryImplementation]).trim().split("\n").sort()
	, [...phpWasmOwnedRefinementEntryImplementationPaths].sort());
});

test("owned-refinement entry history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		phpWasmOwnedRefinementEntryHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmOwnedRefinementEntrySource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmOwnedRefinementEntryUpdate(current, update));
	const edited = structuredClone(record.updates[0]); edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmOwnedRefinementEntryUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]); unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmOwnedRefinementEntryUpdate(current, unknown));
	assert.equal(beforePhpWasmOwnedRefinementEntrySource(update.path, `${current}\n`)
		, `${current}\n`);
});

test("owned-refinement entry history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-owned-entry-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-owned-refinement-entry-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
