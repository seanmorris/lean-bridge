/**
 * Authenticate the callback Subtype hosted-archive foundation history.
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
	beforeCallbackSubtypeHostedArchiveFoundationSource
	, callbackSubtypeHostedArchiveFoundationAddedPaths
	, callbackSubtypeHostedArchiveFoundationHistoryPath
	, callbackSubtypeHostedArchiveFoundationImplementation
	, callbackSubtypeHostedArchiveFoundationImplementationPaths
	, callbackSubtypeHostedArchiveFoundationIntegrationPaths
	, callbackSubtypeHostedArchiveFoundationModifiedPaths
	, callbackSubtypeHostedArchiveFoundationPredecessor
	, reverseCallbackSubtypeHostedArchiveFoundationUpdate
} from "./callback-subtype-hosted-archive-foundation-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype hosted-archive foundation restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeHostedArchiveFoundationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-subtype-hosted-archive-foundation-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeHostedArchiveFoundationPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeHostedArchiveFoundationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeHostedArchiveFoundationModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeHostedArchiveFoundationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeHostedArchiveFoundationAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeHostedArchiveFoundationSource);
		const previous = git(["show"
			, `${callbackSubtypeHostedArchiveFoundationPredecessor}:${update.path}`]);
		assert.equal(
			reverseCallbackSubtypeHostedArchiveFoundationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeHostedArchiveFoundationSource);
		const previous = git(["show"
			, `${callbackSubtypeHostedArchiveFoundationImplementation}:${update.path}`]);
		assert.equal(
			reverseCallbackSubtypeHostedArchiveFoundationUpdate(current, update)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback Subtype hosted-archive foundation range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackSubtypeHostedArchiveFoundationImplementation}^`]).trim()
	, callbackSubtypeHostedArchiveFoundationPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypeHostedArchiveFoundationPredecessor
		, callbackSubtypeHostedArchiveFoundationImplementation])
		.trim().split("\n").sort()
	, [...callbackSubtypeHostedArchiveFoundationImplementationPaths].sort());
});

test("callback Subtype hosted-archive foundation rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeHostedArchiveFoundationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackSubtypeHostedArchiveFoundationSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCallbackSubtypeHostedArchiveFoundationUpdate(current, update));
});

test("callback Subtype hosted-archive writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-subtype-hosted-archive-history-"));
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
		"scripts/update-callback-subtype-hosted-archive-foundation-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
