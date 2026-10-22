/**
 * Authenticate the callback checked-record npm and browser adapters and its
 * refreshed current-source pointers.
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
	beforeCallbackCheckedRecordNpmBrowserSource
	, callbackCheckedRecordNpmBrowserChangedPaths
	, callbackCheckedRecordNpmBrowserHistoryPath
	, callbackCheckedRecordNpmBrowserImplementation
	, callbackCheckedRecordNpmBrowserPredecessor
	, reverseCallbackCheckedRecordNpmBrowserUpdate
} from "./callback-checked-record-npm-browser-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackCheckedRecordNpmBrowserPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback checked-record npm/browser lane history restores every source and pointer", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordNpmBrowserHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-checked-record-npm-browser-source-v1");
	assert.equal(record.predecessorCommit
		, callbackCheckedRecordNpmBrowserPredecessor);
	assert.equal(record.implementationCommit
		, callbackCheckedRecordNpmBrowserImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackCheckedRecordNpmBrowserChangedPaths);
	for(const update of record.updates)
	{
		const milestone = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackCheckedRecordNpmBrowserSource
		);
		assert.equal(sha256(milestone), update.currentSha256, update.path);
		const previous = reverseCallbackCheckedRecordNpmBrowserUpdate(
			milestone, update
		);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackCheckedRecordNpmBrowserSource(
			update.path, milestone), previous);
		assert.equal(beforeCallbackCheckedRecordNpmBrowserSource(
			update.path, milestone, update.currentSha256), milestone);
		assert.equal(beforeFinRefinementSource(
			update.path, milestone, update.previousSha256), previous);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCallbackCheckedRecordNpmBrowserSource(
			update.path, milestone + "unknown"), milestone + "unknown");
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	for(const pin of record.pinContainers)
	{
		let current = await sourceAtFinHistoryMilestone(
			pin.path, pin.currentSha256
		);
		assert.equal(sha256(current), pin.currentSha256, pin.path);
		for(const replacement of [...pin.replacements].reverse())
		{
			assert.equal(current.split(replacement.current).length - 1
				, replacement.count, `${pin.path}: ${replacement.sourcePath}`);
			current = current.replaceAll(
				replacement.current, replacement.previous
			);
		}
		assert.equal(sha256(current), pin.previousSha256, pin.path);
	}
});

test("callback checked-record npm/browser lane history rejects altered transitions"
	, async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordNpmBrowserHistoryPath, "utf8"));
	const update = structuredClone(record.updates[1]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCallbackCheckedRecordNpmBrowserSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackCheckedRecordNpmBrowserUpdate(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseCallbackCheckedRecordNpmBrowserUpdate(
		current, update));
	}
);

test("callback checked-record history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-checked-record-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-checked-record-npm-browser-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
