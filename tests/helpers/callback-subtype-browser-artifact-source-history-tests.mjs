/**
 * Authenticate retained callback Subtype browser artifacts without rewriting history.
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
	beforeCallbackSubtypeBrowserArtifactSource
	, callbackSubtypeBrowserArtifactChangedPaths
	, callbackSubtypeBrowserArtifactHistoryPath
	, callbackSubtypeBrowserArtifactImplementation
	, callbackSubtypeBrowserArtifactPredecessor
	, reverseCallbackSubtypeBrowserArtifactUpdate
} from "./callback-subtype-browser-artifact-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackSubtypeBrowserArtifactPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("callback Subtype browser artifact history restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeBrowserArtifactHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-subtype-browser-artifact-source-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeBrowserArtifactPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeBrowserArtifactImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeBrowserArtifactChangedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeCallbackSubtypeBrowserArtifactSource
		);
		const previous = reverseCallbackSubtypeBrowserArtifactUpdate(
			current, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackSubtypeBrowserArtifactSource(
			update.path, current), previous);
		assert.equal(beforeCallbackSubtypeBrowserArtifactSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeCallbackSubtypeBrowserArtifactSource(
			update.path, current + "unknown"), current + "unknown");
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("callback Subtype browser artifact history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-browser-artifact-history-guard-"
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
		"scripts/update-callback-subtype-browser-artifact-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
