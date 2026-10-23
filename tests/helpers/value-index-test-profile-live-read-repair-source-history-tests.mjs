/**
 * Authenticate the value-index test-profile milestone-read repair.
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
	beforeValueIndexTestProfileLiveReadRepairSource
	, reverseValueIndexTestProfileLiveReadRepairUpdate
	, valueIndexTestProfileLiveReadRepairAddedPaths
	, valueIndexTestProfileLiveReadRepairChangedPaths
	, valueIndexTestProfileLiveReadRepairHistoryPath
	, valueIndexTestProfileLiveReadRepairImplementation
	, valueIndexTestProfileLiveReadRepairIntegrationPaths
	, valueIndexTestProfileLiveReadRepairPredecessor
} from "./value-index-test-profile-live-read-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("value-index profile-read repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		valueIndexTestProfileLiveReadRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "value-index-test-profile-live-read-repair-source-v1");
	assert.equal(record.predecessorCommit
		, valueIndexTestProfileLiveReadRepairPredecessor);
	assert.equal(record.implementationCommit
		, valueIndexTestProfileLiveReadRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, valueIndexTestProfileLiveReadRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, valueIndexTestProfileLiveReadRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, valueIndexTestProfileLiveReadRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeValueIndexTestProfileLiveReadRepairSource);
		const previous = git(["show"
			, `${valueIndexTestProfileLiveReadRepairPredecessor}:${update.path}`]);
		assert.equal(reverseValueIndexTestProfileLiveReadRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeValueIndexTestProfileLiveReadRepairSource);
		const previous = git(["show"
			, `${valueIndexTestProfileLiveReadRepairImplementation}:${update.path}`]);
		assert.equal(reverseValueIndexTestProfileLiveReadRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("value-index profile-read repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${valueIndexTestProfileLiveReadRepairImplementation}^`]).trim()
	, valueIndexTestProfileLiveReadRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, valueIndexTestProfileLiveReadRepairPredecessor
		, valueIndexTestProfileLiveReadRepairImplementation])
		.trim().split("\n").sort()
	, [...valueIndexTestProfileLiveReadRepairChangedPaths].sort());
});

test("value-index profile-read repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		valueIndexTestProfileLiveReadRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeValueIndexTestProfileLiveReadRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseValueIndexTestProfileLiveReadRepairUpdate(
		current, update));
});

test("value-index profile-read writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-value-index-profile-read-history-"));
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
		"scripts/update-value-index-test-profile-live-read-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
