/**
 * Authenticate the callback-Subtype PHP-Wasm Core profile repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource, finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import {
	beforeCallbackSubtypePhpWasmProfileSource
	, callbackSubtypePhpWasmProfileAddedPaths
	, callbackSubtypePhpWasmProfileChangedPaths
	, callbackSubtypePhpWasmProfileHistoryPath
	, callbackSubtypePhpWasmProfileImplementation
	, callbackSubtypePhpWasmProfileImplementationPaths
	, callbackSubtypePhpWasmProfilePredecessor
	, reverseCallbackSubtypePhpWasmProfileUpdate
} from "./callback-subtype-php-wasm-profile-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const profilePath = "src/adoption/test-profiles.mjs";
const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback-Subtype PHP-Wasm profile history restores every source", async () => {
	const record = JSON.parse(await readFile(callbackSubtypePhpWasmProfileHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-php-wasm-profile-v1");
	assert.equal(record.predecessorCommit, callbackSubtypePhpWasmProfilePredecessor);
	assert.equal(record.implementationCommit, callbackSubtypePhpWasmProfileImplementation);
	assert.deepEqual(record.updates.map(item => item.path), callbackSubtypePhpWasmProfileChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path), callbackSubtypePhpWasmProfileAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeCallbackSubtypePhpWasmProfileSource);
		const previous = git(["show", `${callbackSubtypePhpWasmProfilePredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypePhpWasmProfileUpdate(current, update), previous, update.path);
		assert.equal(beforeCallbackSubtypePhpWasmProfileSource(update.path, current), previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256, addition.path);
	const profile = record.updates.find(item => item.path === profilePath);
	assert.deepEqual(profile.addedTests, ["callback-subtype-php-wasm"]);
	const current = await sourceAtFinHistoryMilestone(
		profile.path, profile.currentSha256, beforeCallbackSubtypePhpWasmProfileSource);
	const previous = reverseCallbackSubtypePhpWasmProfileUpdate(current, profile);
	assert.equal(previous.includes('"callback-subtype-php-wasm"'), false);
	assert.equal(current.split('"callback-subtype-php-wasm"').length - 1, 1);
	assert.equal(classifyRepositoryTest("tests/callback-subtype-php-wasm.test.mjs"), "contract");
});

test("callback-Subtype PHP-Wasm profile implementation range is exact", () => {
	assert.equal(git(["rev-parse", `${callbackSubtypePhpWasmProfileImplementation}^`]).trim()
		, callbackSubtypePhpWasmProfilePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypePhpWasmProfilePredecessor
		, callbackSubtypePhpWasmProfileImplementation])
		.trim().split("\n").sort()
	, [...callbackSubtypePhpWasmProfileImplementationPaths].sort());
});

test("callback-Subtype PHP-Wasm profile history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(callbackSubtypePhpWasmProfileHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeCallbackSubtypePhpWasmProfileSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackSubtypePhpWasmProfileUpdate(current, update));
	const edited = structuredClone(record.updates[0]); edited.edits[0].current += "x";
	assert.throws(() => reverseCallbackSubtypePhpWasmProfileUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]); unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reverseCallbackSubtypePhpWasmProfileUpdate(current, unknown));
	assert.equal(beforeCallbackSubtypePhpWasmProfileSource(update.path, `${current}\n`), `${current}\n`);
});

test("callback-Subtype PHP-Wasm profile writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-subtype-php-wasm-profile-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-subtype-php-wasm-profile-source-history.mjs")]
	, { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
