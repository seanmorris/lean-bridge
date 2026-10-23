/**
 * Authenticate the value-index promotion milestone and bounded-cell repair.
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
	beforeValueIndexPromotionMemoryRepairSource
	, reverseValueIndexPromotionMemoryRepairUpdate
	, valueIndexPromotionMemoryRepairAddedPaths
	, valueIndexPromotionMemoryRepairChangedPaths
	, valueIndexPromotionMemoryRepairHistoryPath
	, valueIndexPromotionMemoryRepairImplementation
	, valueIndexPromotionMemoryRepairIntegrationPaths
	, valueIndexPromotionMemoryRepairPredecessor
} from "./value-index-promotion-memory-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("value-index promotion memory repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		valueIndexPromotionMemoryRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "value-index-promotion-memory-repair-source-v1");
	assert.equal(record.predecessorCommit
		, valueIndexPromotionMemoryRepairPredecessor);
	assert.equal(record.implementationCommit
		, valueIndexPromotionMemoryRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, valueIndexPromotionMemoryRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, valueIndexPromotionMemoryRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, valueIndexPromotionMemoryRepairAddedPaths);
	assert.equal(record.pinCount, 77);
	assert.deepEqual(record.pinUpdates.map(item => [item.path, item.count]), [
		["src/adoption/type-surface.mjs", 38]
		, ["tests/helpers/checked-record-value-index-browser-promotion-tests.mjs", 4]
		, ["tests/type-surface.test.mjs", 35]
	]);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeValueIndexPromotionMemoryRepairSource);
		const previous = git(["show"
			, `${valueIndexPromotionMemoryRepairPredecessor}:${update.path}`]);
		assert.equal(reverseValueIndexPromotionMemoryRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeValueIndexPromotionMemoryRepairSource);
		const previous = git(["show"
			, `${valueIndexPromotionMemoryRepairImplementation}:${update.path}`]);
		assert.equal(reverseValueIndexPromotionMemoryRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("value-index promotion memory repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${valueIndexPromotionMemoryRepairImplementation}^`]).trim()
	, valueIndexPromotionMemoryRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, valueIndexPromotionMemoryRepairPredecessor
		, valueIndexPromotionMemoryRepairImplementation])
		.trim().split("\n").sort()
	, [...valueIndexPromotionMemoryRepairChangedPaths].sort());
});

test("value-index promotion memory repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		valueIndexPromotionMemoryRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeValueIndexPromotionMemoryRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseValueIndexPromotionMemoryRepairUpdate(
		current, update));
});

test("value-index promotion memory writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-value-index-promotion-memory-history-"));
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
		"scripts/update-value-index-promotion-memory-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
