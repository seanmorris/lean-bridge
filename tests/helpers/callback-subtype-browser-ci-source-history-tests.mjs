/**
 * Preserve the exact hosted callback Subtype browser CI source closure.
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
	callbackSubtypeBrowserCiAddedPaths
	, callbackSubtypeBrowserCiHistoryPath
	, callbackSubtypeBrowserCiImplementation
	, callbackSubtypeBrowserCiPredecessor
} from "./callback-subtype-browser-ci-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

test("callback Subtype browser CI history authenticates every added source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeBrowserCiHistoryPath, "utf8"
	));
	assert.deepEqual(record, {
		schemaVersion: 1
		, milestone: "callback-subtype-browser-ci-source-v1"
		, predecessorCommit: callbackSubtypeBrowserCiPredecessor
		, implementationCommit: callbackSubtypeBrowserCiImplementation
		, additions: record.additions
	});
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeBrowserCiAddedPaths);
	for(const addition of record.additions)
	{
		assert.equal(execFileSync("git", ["ls-tree", "--name-only"
			, callbackSubtypeBrowserCiPredecessor, "--", addition.path]
		, { encoding: "utf8" }).trim(), "", addition.path);
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	}
});

test("callback Subtype browser CI history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-browser-ci-history-guard-"
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
		"scripts/update-callback-subtype-browser-ci-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
