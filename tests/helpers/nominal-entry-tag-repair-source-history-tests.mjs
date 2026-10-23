/**
 * Authenticate the native nominal entry-probe variant-tag repair.
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
	beforeNominalEntryTagRepairSource
	, nominalEntryTagRepairAddedPaths
	, nominalEntryTagRepairChangedPaths
	, nominalEntryTagRepairHistoryPath
	, nominalEntryTagRepairImplementation
	, nominalEntryTagRepairIntegrationPaths
	, nominalEntryTagRepairPredecessor
	, reverseNominalEntryTagRepairUpdate
} from "./nominal-entry-tag-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("nominal entry tag repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		nominalEntryTagRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "nominal-entry-tag-repair-source-v1");
	assert.equal(record.predecessorCommit, nominalEntryTagRepairPredecessor);
	assert.equal(record.implementationCommit, nominalEntryTagRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, nominalEntryTagRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, nominalEntryTagRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, nominalEntryTagRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeNominalEntryTagRepairSource);
		const previous = git(["show"
			, `${nominalEntryTagRepairPredecessor}:${update.path}`]);
		assert.equal(reverseNominalEntryTagRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeNominalEntryTagRepairSource);
		const previous = git(["show"
			, `${nominalEntryTagRepairImplementation}:${update.path}`]);
		assert.equal(reverseNominalEntryTagRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("nominal entry tag repair range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${nominalEntryTagRepairImplementation}^`]).trim()
	, nominalEntryTagRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, nominalEntryTagRepairPredecessor, nominalEntryTagRepairImplementation])
		.trim().split("\n").sort(), [...nominalEntryTagRepairChangedPaths].sort());
});

test("nominal entry tag repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		nominalEntryTagRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeNominalEntryTagRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseNominalEntryTagRepairUpdate(current, update));
});

test("nominal entry tag repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-nominal-entry-tag-repair-history-"));
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
		"scripts/update-nominal-entry-tag-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
