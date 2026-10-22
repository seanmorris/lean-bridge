/**
 * Authenticate the PHP-Wasm callback Subtype source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeCallbackSubtypePhpWasmSource
	, callbackSubtypePhpWasmAddedPaths
	, callbackSubtypePhpWasmChangedPaths
	, callbackSubtypePhpWasmEvidencePath
	, callbackSubtypePhpWasmHistoryPath
	, callbackSubtypePhpWasmImplementation
	, callbackSubtypePhpWasmImplementationPaths
	, callbackSubtypePhpWasmPredecessor
	, reverseCallbackSubtypePhpWasmUpdate
} from "./callback-subtype-php-wasm-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("PHP-Wasm callback Subtype history restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypePhpWasmHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-php-wasm-v1");
	assert.equal(record.predecessorCommit, callbackSubtypePhpWasmPredecessor);
	assert.equal(record.implementationCommit, callbackSubtypePhpWasmImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypePhpWasmChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypePhpWasmAddedPaths);
	assert.equal(record.acceptanceEvidence.path
		, callbackSubtypePhpWasmEvidencePath);
	assert.equal(record.acceptanceEvidence.sha256
		, sha256(await readFile(callbackSubtypePhpWasmEvidencePath)));
	for(const update of record.updates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show"
			, `${callbackSubtypePhpWasmPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCallbackSubtypePhpWasmUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCallbackSubtypePhpWasmSource(
			update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("PHP-Wasm callback Subtype implementation range is exact", () => {
	assert.equal(git(["merge-base", callbackSubtypePhpWasmPredecessor
		, callbackSubtypePhpWasmImplementation]).trim()
	, callbackSubtypePhpWasmPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypePhpWasmPredecessor
		, callbackSubtypePhpWasmImplementation]).trim().split("\n").sort()
	, [...callbackSubtypePhpWasmImplementationPaths].sort());
});

test("PHP-Wasm callback Subtype history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypePhpWasmHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await readFile(update.path, "utf8");
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackSubtypePhpWasmUpdate(
		current, update));
});

test("PHP-Wasm callback Subtype history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-subtype-php-wasm-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-subtype-php-wasm-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
