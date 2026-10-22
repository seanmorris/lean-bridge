/**
 * Authenticate the PHP-Wasm callback Fin and checked-record source history.
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
	beforeCallbackRefinementsPhpWasmSource
	, callbackRefinementsPhpWasmAddedPaths
	, callbackRefinementsPhpWasmChangedPaths
	, callbackRefinementsPhpWasmHistoryPath
	, callbackRefinementsPhpWasmImplementation
	, callbackRefinementsPhpWasmImplementationPaths
	, callbackRefinementsPhpWasmPredecessor
	, reverseCallbackRefinementsPhpWasmUpdate
} from "./callback-refinements-php-wasm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm callback-refinement history restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackRefinementsPhpWasmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-refinements-php-wasm-v1");
	assert.equal(record.predecessorCommit
		, callbackRefinementsPhpWasmPredecessor);
	assert.equal(record.implementationCommit
		, callbackRefinementsPhpWasmImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackRefinementsPhpWasmChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackRefinementsPhpWasmAddedPaths);
	assert.deepEqual(record.historicalUpdates.map(item => item.path)
		, ["src/adoption/test-profiles.mjs"]);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackRefinementsPhpWasmSource
		);
		const previous = git(["show"
			, `${callbackRefinementsPhpWasmPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackRefinementsPhpWasmUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCallbackRefinementsPhpWasmSource(
			update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
	const historical = record.historicalUpdates[0];
	const historicalCurrent = git(["show"
		, `22c1efd6c9c66c42ba438a07ca6adff6fbc7f2c5:${historical.path}`]);
	const historicalPrevious = git(["show"
		, `209b13b86b8d23a10a76de73bbf1c1f095d5fe31:${historical.path}`]);
	assert.equal(sha256(historicalCurrent), historical.currentSha256);
	assert.equal(reverseCallbackRefinementsPhpWasmUpdate(
		historicalCurrent, historical), historicalPrevious);
});

test("PHP-Wasm callback-refinement implementation range is exact", () => {
	assert.equal(git(["merge-base", callbackRefinementsPhpWasmPredecessor
		, callbackRefinementsPhpWasmImplementation]).trim()
	, callbackRefinementsPhpWasmPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackRefinementsPhpWasmPredecessor
		, callbackRefinementsPhpWasmImplementation]).trim().split("\n").sort()
	, [...callbackRefinementsPhpWasmImplementationPaths].sort());
});

test("PHP-Wasm callback-refinement history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		callbackRefinementsPhpWasmHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCallbackRefinementsPhpWasmSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackRefinementsPhpWasmUpdate(
		current, update));
});

test("PHP-Wasm callback-refinement history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-refinements-php-wasm-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-refinements-php-wasm-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
