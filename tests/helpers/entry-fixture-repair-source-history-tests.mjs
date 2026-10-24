/**
 * Authenticate the explicit Entry fixture repair.
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
	beforeEntryFixtureRepairSource
	, entryFixtureRepairAddedPaths
	, entryFixtureRepairChangedPaths
	, entryFixtureRepairHistoryPath
	, entryFixtureRepairImplementation
	, entryFixtureRepairIntegrationBase
	, entryFixtureRepairIntegrationPaths
	, entryFixtureRepairPredecessor
	, reverseEntryFixtureRepairUpdate
} from "./entry-fixture-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Entry fixture repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		entryFixtureRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "entry-fixture-repair-source-v1");
	assert.equal(record.predecessorCommit
		, entryFixtureRepairPredecessor);
	assert.equal(record.implementationCommit
		, entryFixtureRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, entryFixtureRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, entryFixtureRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, entryFixtureRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, entryFixtureRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeEntryFixtureRepairSource);
		const previous = git(["show"
			, `${entryFixtureRepairPredecessor}:${update.path}`]);
		assert.equal(reverseEntryFixtureRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeEntryFixtureRepairSource);
		const previous = git(["show"
			, `${entryFixtureRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseEntryFixtureRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Entry fixture repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${entryFixtureRepairImplementation}^`]).trim()
	, entryFixtureRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, entryFixtureRepairPredecessor
		, entryFixtureRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...entryFixtureRepairChangedPaths].sort());
});

test("Entry fixture repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		entryFixtureRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeEntryFixtureRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseEntryFixtureRepairUpdate(
		current, update));
});

test("Entry fixture writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-entry-fixture-repair-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-entry-fixture-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
