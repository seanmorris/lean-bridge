/**
 * Authenticate the native callback Subtype implementation and current pointers.
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
	beforeCallbackSubtypeNativeSource
	, callbackSubtypeNativeChangedPaths
	, callbackSubtypeNativeHistoryPath
	, callbackSubtypeNativeImplementation
	, callbackSubtypeNativePredecessor
	, reverseCallbackSubtypeNativeUpdate
} from "./callback-subtype-native-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackSubtypeNativePredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype native history restores every changed source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeNativeHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-native-source-v1");
	assert.equal(record.predecessorCommit, callbackSubtypeNativePredecessor);
	assert.equal(record.implementationCommit, callbackSubtypeNativeImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeNativeChangedPaths);
	assert.ok(record.repairedTypeSurfacePointers > 0);
	for(const update of record.updates)
	{
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8")
			, update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseCallbackSubtypeNativeUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackSubtypeNativeSource(
			update.path, current), previous);
		assert.equal(beforeCallbackSubtypeNativeSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeCallbackSubtypeNativeSource(
			update.path, current + "unknown"), current + "unknown");
	}
	for(const addition of record.additions)
	{
		const current = beforeFinRefinementSource(
			addition.path, await readFile(addition.path, "utf8")
			, addition.currentSha256
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
});

test("callback Subtype native history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-native-history-guard-"
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
		"scripts/update-callback-subtype-native-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
