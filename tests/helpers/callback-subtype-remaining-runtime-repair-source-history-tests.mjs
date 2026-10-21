/**
 * Authenticate the remaining-host callback Subtype runtime repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeCallbackSubtypeRemainingRuntimeRepairSource
	, callbackSubtypeRemainingRuntimeRepairChangedPaths
	, callbackSubtypeRemainingRuntimeRepairHistoryPath
	, callbackSubtypeRemainingRuntimeRepairImplementation
	, callbackSubtypeRemainingRuntimeRepairIntegrationPaths
	, callbackSubtypeRemainingRuntimeRepairPredecessor
	, reverseCallbackSubtypeRemainingRuntimeRepairUpdate
} from "./callback-subtype-remaining-runtime-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("remaining-host callback Subtype runtime repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeRemainingRuntimeRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "callback-subtype-remaining-runtime-repair-source-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeRemainingRuntimeRepairPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeRemainingRuntimeRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeRemainingRuntimeRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeRemainingRuntimeRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackSubtypeRemainingRuntimeRepairSource);
		assert.equal(reverseCallbackSubtypeRemainingRuntimeRepairUpdate(current, update)
			, sourceAt(callbackSubtypeRemainingRuntimeRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(callbackSubtypeRemainingRuntimeRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackSubtypeRemainingRuntimeRepairSource);
		assert.equal(reverseCallbackSubtypeRemainingRuntimeRepairUpdate(current, update)
			, sourceAt(callbackSubtypeRemainingRuntimeRepairImplementation, update.path));
	}
});

test("remaining-host callback Subtype runtime repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeRemainingRuntimeRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCallbackSubtypeRemainingRuntimeRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackSubtypeRemainingRuntimeRepairUpdate(
		current, update));
});

test("remaining-host callback runtime repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-remaining-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-subtype-remaining-runtime-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
