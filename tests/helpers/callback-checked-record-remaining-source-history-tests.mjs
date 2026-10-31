/**
 * Authenticate the remaining-host callback checked-record transition.
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
	beforeCallbackCheckedRecordRemainingSource
	, callbackCheckedRecordRemainingChangedPaths
	, callbackCheckedRecordRemainingHistoryPath
	, callbackCheckedRecordRemainingImplementation
	, callbackCheckedRecordRemainingPredecessor
	, reverseCallbackCheckedRecordRemainingUpdate
} from "./callback-checked-record-remaining-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryRecord
	, sourceAtFinHistoryRecordSource
	, sourceBeforeFinHistoryRecord
} from "./source-at-fin-history-milestone.mjs";

const original = path => execFileSync("git", ["show"
	, `${callbackCheckedRecordRemainingPredecessor}:${path}`]
, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback checked-record remaining history restores every changed source", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordRemainingHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-checked-record-remaining-source-v1");
	assert.equal(record.predecessorCommit, callbackCheckedRecordRemainingPredecessor);
	assert.equal(record.implementationCommit, callbackCheckedRecordRemainingImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackCheckedRecordRemainingChangedPaths);
	assert.ok(record.repairedTypeSurfacePointers > 0);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryRecord(
			callbackCheckedRecordRemainingHistoryPath, update.path
			, beforeFinRefinementSource
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = reverseCallbackCheckedRecordRemainingUpdate(current, update);
		assert.equal(previous, original(update.path));
		assert.equal(beforeCallbackCheckedRecordRemainingSource(
			update.path, current), previous);
		assert.equal(beforeCallbackCheckedRecordRemainingSource(
			update.path, current, update.currentSha256), current);
		assert.equal(await sourceBeforeFinHistoryRecord(
			callbackCheckedRecordRemainingHistoryPath, update.path
			, beforeFinRefinementSource
		), previous);
		assert.equal(beforeCallbackCheckedRecordRemainingSource(
			update.path, current + "unknown"), current + "unknown");
	}
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryRecordSource(
			callbackCheckedRecordRemainingHistoryPath, addition.path
			, addition.currentSha256, beforeFinRefinementSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
	}
});

test("callback checked-record remaining history writer refuses an unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-callback-checked-record-remaining-history-guard-"
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
		"scripts/update-callback-checked-record-remaining-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
