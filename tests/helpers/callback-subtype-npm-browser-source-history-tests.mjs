/**
 * Authenticate the npm/browser callback Subtype runtime and its repaired
 * current-source pointers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeCallbackSubtypeNpmAcceptanceSource } from "./callback-subtype-npm-acceptance-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeCallbackSubtypeNpmBrowserPointers
	, beforeCallbackSubtypeNpmBrowserSource
	, callbackSubtypeNpmBrowserChangedPaths
	, callbackSubtypeNpmBrowserHistoryPath
	, callbackSubtypeNpmBrowserImplementation
	, callbackSubtypeNpmBrowserPredecessor
	, reverseCallbackSubtypeNpmBrowserUpdate
} from "./callback-subtype-npm-browser-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackSubtypeNpmBrowserPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("callback Subtype npm/browser history restores every source and pointer", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeNpmBrowserHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-npm-browser-source-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeNpmBrowserPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeNpmBrowserImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeNpmBrowserChangedPaths);
	for(const update of record.updates)
	{
		const latest = await readFile(update.path, "utf8");
		const current = beforeFinRefinementSource(
			update.path, latest, update.currentSha256
		);
		const milestone = beforeCallbackSubtypeNpmAcceptanceSource(
			update.path, current, update.currentSha256
		);
		const previous = reverseCallbackSubtypeNpmBrowserUpdate(
			milestone, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackSubtypeNpmBrowserSource(
			update.path, milestone), previous);
		assert.equal(beforeCallbackSubtypeNpmBrowserSource(
			update.path, milestone, update.currentSha256), milestone);
		assert.equal(beforeCallbackSubtypeNpmBrowserSource(
			update.path, latest + "unknown"), latest + "unknown");
	}
	for(const addition of record.additions)
	{
		const current = beforeFinRefinementSource(
			addition.path, await readFile(addition.path, "utf8")
			, addition.currentSha256
		);
		const milestone = beforeCallbackSubtypeNpmAcceptanceSource(
			addition.path, current, addition.currentSha256
		);
		assert.equal(sha256(milestone), addition.currentSha256, addition.path);
	}
	for(const pin of record.pinContainers)
	{
		const current = beforeFinRefinementSource(
			pin.path, await readFile(pin.path, "utf8")
			, pin.currentSha256
		);
		assert.equal(sha256(current), pin.currentSha256, pin.path);
		assert.equal(sha256(beforeCallbackSubtypeNpmBrowserPointers(
			pin.path, current)), pin.previousSha256, pin.path);
	}
});

test("callback Subtype npm/browser history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-subtype-npm-browser-history-guard-"
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
		"scripts/update-callback-subtype-npm-browser-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
