/**
 * Authenticate the value-index browser promotion closure repair.
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
	beforeValueIndexBrowserPromotionClosureRepairSource
	, reverseValueIndexBrowserPromotionClosureRepairUpdate
	, valueIndexBrowserPromotionClosureRepairAddedPaths
	, valueIndexBrowserPromotionClosureRepairChangedPaths
	, valueIndexBrowserPromotionClosureRepairHistoryPath
	, valueIndexBrowserPromotionClosureRepairImplementation
	, valueIndexBrowserPromotionClosureRepairIntegrationPaths
	, valueIndexBrowserPromotionClosureRepairPredecessor
} from "./value-index-browser-promotion-closure-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("value-index browser promotion closure repair restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			valueIndexBrowserPromotionClosureRepairHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "value-index-browser-promotion-closure-repair-source-v1");
		assert.equal(record.predecessorCommit
			, valueIndexBrowserPromotionClosureRepairPredecessor);
		assert.equal(record.implementationCommit
			, valueIndexBrowserPromotionClosureRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, valueIndexBrowserPromotionClosureRepairChangedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, valueIndexBrowserPromotionClosureRepairIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, valueIndexBrowserPromotionClosureRepairAddedPaths);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeValueIndexBrowserPromotionClosureRepairSource);
			const previous = git(["show"
				, `${valueIndexBrowserPromotionClosureRepairPredecessor}:${update.path}`]);
			assert.equal(reverseValueIndexBrowserPromotionClosureRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeFinRefinementSource(
				update.path, current, update.previousSha256), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const update of record.integrationUpdates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeValueIndexBrowserPromotionClosureRepairSource);
			const previous = git(["show"
				, `${valueIndexBrowserPromotionClosureRepairImplementation}:${update.path}`]);
			assert.equal(reverseValueIndexBrowserPromotionClosureRepairUpdate(
				current, update), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("value-index browser promotion closure repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${valueIndexBrowserPromotionClosureRepairImplementation}^`]).trim()
	, valueIndexBrowserPromotionClosureRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, valueIndexBrowserPromotionClosureRepairPredecessor
		, valueIndexBrowserPromotionClosureRepairImplementation])
		.trim().split("\n").sort()
	, [...valueIndexBrowserPromotionClosureRepairChangedPaths].sort());
});

test("value-index browser promotion closure repair rejects alteration"
	, async () => {
		const record = JSON.parse(await readFile(
			valueIndexBrowserPromotionClosureRepairHistoryPath, "utf8"));
		const update = structuredClone(record.updates[0]);
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeValueIndexBrowserPromotionClosureRepairSource);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() =>
			reverseValueIndexBrowserPromotionClosureRepairUpdate(current, update));
	}
);

test("value-index browser promotion closure writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-value-index-browser-closure-history-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		const env = Object.fromEntries(Object.entries(process.env)
			.filter(([key]) => !key.startsWith("GIT_")));
		const run = args => execFileSync("git", args
			, { cwd: root, env, stdio: "pipe" });
		run(["init", "--quiet"]);
		run(["-c", "user.name=Test", "-c"
			, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
			, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
		const result = spawnSync(process.execPath, [resolve(
			"scripts/update-value-index-browser-promotion-closure-repair-source-history.mjs"
		)], { cwd: root, env, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /exact implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
