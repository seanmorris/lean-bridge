/**
 * Authenticate the Core Ruby-model availability repair.
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
	beforeCoreRubyModelAvailabilityRepairSource
	, coreRubyModelAvailabilityRepairAddedPaths
	, coreRubyModelAvailabilityRepairChangedPaths
	, coreRubyModelAvailabilityRepairHistoryPath
	, coreRubyModelAvailabilityRepairImplementation
	, coreRubyModelAvailabilityRepairIntegrationPaths
	, coreRubyModelAvailabilityRepairPredecessor
	, reverseCoreRubyModelAvailabilityRepairUpdate
} from "./core-ruby-model-availability-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Core Ruby-model availability repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		coreRubyModelAvailabilityRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-ruby-model-availability-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreRubyModelAvailabilityRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreRubyModelAvailabilityRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreRubyModelAvailabilityRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreRubyModelAvailabilityRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreRubyModelAvailabilityRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCoreRubyModelAvailabilityRepairSource);
		const previous = git(["show"
			, `${coreRubyModelAvailabilityRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCoreRubyModelAvailabilityRepairUpdate(
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
			, beforeCoreRubyModelAvailabilityRepairSource);
		const previous = git(["show"
			, `${coreRubyModelAvailabilityRepairImplementation}:${update.path}`]);
		assert.equal(reverseCoreRubyModelAvailabilityRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core Ruby-model availability repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${coreRubyModelAvailabilityRepairImplementation}^`]).trim()
	, coreRubyModelAvailabilityRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreRubyModelAvailabilityRepairPredecessor
		, coreRubyModelAvailabilityRepairImplementation])
		.trim().split("\n").sort()
	, [...coreRubyModelAvailabilityRepairChangedPaths].sort());
});

test("Core Ruby-model availability repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		coreRubyModelAvailabilityRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCoreRubyModelAvailabilityRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCoreRubyModelAvailabilityRepairUpdate(
		current, update));
});

test("Core Ruby-model availability writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-ruby-model-availability-repair-"));
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
		"scripts/update-core-ruby-model-availability-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
