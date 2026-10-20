/**
 * Authenticate the Python, Ruby and Rust callback Subtype transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeCallbackSubtypeRemainingSource } from "./callback-subtype-remaining-source-history.mjs";
import {
	beforeCallbackSubtypeLanguageSource
	, callbackSubtypeLanguageChangedPaths
	, callbackSubtypeLanguageHistoryPath
	, callbackSubtypeLanguageImplementation
	, callbackSubtypeLanguagePredecessor
	, reverseCallbackSubtypeLanguageUpdate
} from "./callback-subtype-language-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackSubtypeLanguagePredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("callback Subtype language history restores every changed source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeLanguageHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-languages-source-v1");
	assert.equal(record.predecessorCommit, callbackSubtypeLanguagePredecessor);
	assert.equal(record.implementationCommit, callbackSubtypeLanguageImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeLanguageChangedPaths);
	assert.ok(record.repairedTypeSurfacePointers > 0);
	for(const update of record.updates)
	{
		const latest = await readFile(update.path, "utf8");
		const current = beforeCallbackSubtypeRemainingSource(
			update.path, latest, update.currentSha256);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseCallbackSubtypeLanguageUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackSubtypeLanguageSource(
			update.path, current), previous);
		assert.equal(beforeCallbackSubtypeLanguageSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeCallbackSubtypeLanguageSource(
			update.path, current + "unknown"), current + "unknown");
	}
	for(const addition of record.additions)
	{
		const latest = await readFile(addition.path, "utf8");
		const current = beforeCallbackSubtypeRemainingSource(
			addition.path, latest, addition.currentSha256);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
});

test("callback Subtype language history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-languages-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-subtype-language-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
