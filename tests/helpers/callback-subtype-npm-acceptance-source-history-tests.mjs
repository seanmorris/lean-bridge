/**
 * Authenticate callback Subtype npm acceptance and reconciled evidence paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeCallbackSubtypeBrowserArtifactSource } from "./callback-subtype-browser-artifact-source-history.mjs";
import {
	beforeCallbackSubtypeNpmAcceptanceSource
	, callbackSubtypeNpmAcceptanceChangedPaths
	, callbackSubtypeNpmAcceptanceHistoryPath
	, callbackSubtypeNpmAcceptanceImplementation
	, callbackSubtypeNpmAcceptancePredecessor
	, reverseCallbackSubtypeNpmAcceptanceUpdate
} from "./callback-subtype-npm-acceptance-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryRecordSource } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackSubtypeNpmAcceptancePredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype npm acceptance history restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeNpmAcceptanceHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-npm-acceptance-source-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeNpmAcceptancePredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeNpmAcceptanceImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeNpmAcceptanceChangedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryRecordSource(
			callbackSubtypeNpmAcceptanceHistoryPath, update.path
			, update.currentSha256, beforeCallbackSubtypeNpmAcceptanceSource
		);
		const previous = reverseCallbackSubtypeNpmAcceptanceUpdate(
			current, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackSubtypeNpmAcceptanceSource(
			update.path, current), previous);
		assert.equal(beforeCallbackSubtypeNpmAcceptanceSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeCallbackSubtypeNpmAcceptanceSource(
			update.path, current + "unknown"), current + "unknown");
	}
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryRecordSource(
			callbackSubtypeNpmAcceptanceHistoryPath, addition.path
			, addition.currentSha256, beforeCallbackSubtypeBrowserArtifactSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
});

test("callback Subtype npm acceptance history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-npm-acceptance-history-guard-"
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
		"scripts/update-callback-subtype-npm-acceptance-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
