/**
 * Authenticate the checked-refinement hosted-gate repair range.
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
	beforeCheckedRefinementGateRepairSource
	, checkedRefinementGateRepairAddedPaths
	, checkedRefinementGateRepairCommits
	, checkedRefinementGateRepairHistoryPath
	, checkedRefinementGateRepairImplementation
	, checkedRefinementGateRepairImplementationPaths
	, checkedRefinementGateRepairIntegrationPaths
	, checkedRefinementGateRepairModifiedPaths
	, checkedRefinementGateRepairPredecessor
	, reverseCheckedRefinementGateRepairUpdate
} from "./checked-refinement-gate-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("checked-refinement gate repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		checkedRefinementGateRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-refinement-gate-repair-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRefinementGateRepairPredecessor);
	assert.equal(record.implementationCommit
		, checkedRefinementGateRepairImplementation);
	assert.deepEqual(record.implementationCommits
		, checkedRefinementGateRepairCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, checkedRefinementGateRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, checkedRefinementGateRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRefinementGateRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCheckedRefinementGateRepairSource);
		const previous = git(["show"
			, `${checkedRefinementGateRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCheckedRefinementGateRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	const nominalFixture = record.updates.find(update => update.path
		=== "tests/fixtures/onboarding/nominal-subtypes/NominalSubtypes.lean");
	assert.ok(nominalFixture);
	const nominalCurrent = await sourceAtFinHistoryMilestone(
		nominalFixture.path, nominalFixture.currentSha256
		, beforeCheckedRefinementGateRepairSource);
	assert.equal(beforeFinRefinementSource(
		nominalFixture.path, nominalCurrent), git(["show"
		, `${checkedRefinementGateRepairPredecessor}:${nominalFixture.path}`]));
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCheckedRefinementGateRepairSource);
		const previous = git(["show"
			, `${checkedRefinementGateRepairImplementation}:${update.path}`]);
		assert.equal(reverseCheckedRefinementGateRepairUpdate(current, update)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("checked-refinement gate repair range is exact", () => {
	assert.deepEqual(git(["rev-list", "--reverse", "--ancestry-path"
		, `${checkedRefinementGateRepairPredecessor}..${checkedRefinementGateRepairImplementation}`]).trim().split("\n")
	, checkedRefinementGateRepairCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, checkedRefinementGateRepairPredecessor
		, checkedRefinementGateRepairImplementation]).trim().split("\n").sort()
	, [...checkedRefinementGateRepairImplementationPaths].sort());
});

test("checked-refinement gate repair rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		checkedRefinementGateRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCheckedRefinementGateRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCheckedRefinementGateRepairUpdate(current, update));
});

test("checked-refinement gate writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-checked-refinement-gate-history-"));
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
		"scripts/update-checked-refinement-gate-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
