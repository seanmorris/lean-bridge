/**
 * Authenticate the callback producer replay history.
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
	beforeCallbackProducerReplaySource
	, callbackProducerReplayAddedPaths
	, callbackProducerReplayHistoryPath
	, callbackProducerReplayImplementation
	, callbackProducerReplayImplementationPaths
	, callbackProducerReplayIntegrationPaths
	, callbackProducerReplayModifiedPaths
	, callbackProducerReplayPredecessor
	, reverseCallbackProducerReplayUpdate
} from "./callback-producer-replay-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });

test("callback producer replay history restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackProducerReplayHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-producer-replay-source-v1");
	assert.equal(record.predecessorCommit
		, callbackProducerReplayPredecessor);
	assert.equal(record.implementationCommit
		, callbackProducerReplayImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackProducerReplayModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackProducerReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackProducerReplayAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackProducerReplaySource);
		const previous = git(["show"
			, `${callbackProducerReplayPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackProducerReplayUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackProducerReplaySource);
		const previous = git(["show"
			, `${callbackProducerReplayImplementation}:${update.path}`]);
		assert.equal(reverseCallbackProducerReplayUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback producer replay history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackProducerReplayImplementation}^`]).trim()
	, callbackProducerReplayPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackProducerReplayPredecessor
		, callbackProducerReplayImplementation])
		.trim().split("\n").sort()
	, [...callbackProducerReplayImplementationPaths].sort());
});

test("callback producer replay history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		callbackProducerReplayHistoryPath, "utf8"));
	const update = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackProducerReplaySource);
	assert.equal(beforeCallbackProducerReplaySource(update.path, current, update.currentSha256)
		, current);
	assert.equal(sha256(beforeCallbackProducerReplaySource(update.path, current, update.previousSha256))
		, update.previousSha256);
	const unknown = current + "\n/* unrelated bytes */\n";
	assert.equal(beforeCallbackProducerReplaySource(update.path, unknown, update.previousSha256), unknown);
	for(const key of ["currentSha256", "previousSha256"])
		assert.throws(() => reverseCallbackProducerReplayUpdate(current, {
			...update, [key]: "0".repeat(64)
		}));
});

test("callback producer replay history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-producer-replay-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-producer-replay-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
