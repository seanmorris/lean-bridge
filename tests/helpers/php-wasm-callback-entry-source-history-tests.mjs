/**
 * Authenticate synchronous callback-entry PHP-Wasm source history.
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
	beforePhpWasmCallbackEntrySource, phpWasmCallbackEntryAddedPaths
	, phpWasmCallbackEntryChangedPaths, phpWasmCallbackEntryHistoryPath
	, phpWasmCallbackEntryImplementation, phpWasmCallbackEntryImplementationPaths
	, phpWasmCallbackEntryPredecessor, reversePhpWasmCallbackEntryUpdate
} from "./php-wasm-callback-entry-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback-entry history restores every exact source", async () => {
	const record = JSON.parse(await readFile(phpWasmCallbackEntryHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "php-wasm-callback-entry-v1");
	assert.equal(record.predecessorCommit, phpWasmCallbackEntryPredecessor);
	assert.equal(record.implementationCommit, phpWasmCallbackEntryImplementation);
	assert.deepEqual(record.updates.map(item => item.path), phpWasmCallbackEntryChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path), phpWasmCallbackEntryAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforePhpWasmCallbackEntrySource);
		const previous = git(["show", `${phpWasmCallbackEntryPredecessor}:${update.path}`]);
		assert.equal(reversePhpWasmCallbackEntryUpdate(current, update), previous, update.path);
		assert.equal(beforePhpWasmCallbackEntrySource(update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
});

test("callback-entry implementation range is exact", () => {
	assert.equal(git(["merge-base", phpWasmCallbackEntryPredecessor
		, phpWasmCallbackEntryImplementation]).trim(), phpWasmCallbackEntryPredecessor);
	assert.deepEqual(git(["diff", "--name-only", phpWasmCallbackEntryPredecessor
		, phpWasmCallbackEntryImplementation]).trim().split("\n").sort()
	, [...phpWasmCallbackEntryImplementationPaths].sort());
});

test("callback-entry history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(phpWasmCallbackEntryHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforePhpWasmCallbackEntrySource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reversePhpWasmCallbackEntryUpdate(current, update));
	const edited = structuredClone(record.updates[0]); edited.edits[0].current += "x";
	assert.throws(() => reversePhpWasmCallbackEntryUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]); unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reversePhpWasmCallbackEntryUpdate(current, unknown));
});

test("callback-entry history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-php-wasm-callback-entry-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-php-wasm-callback-entry-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1); assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
