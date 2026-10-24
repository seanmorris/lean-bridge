/**
 * Authenticate the explicit Author refinement guidance repair.
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
	beforeAuthorRefinementGuidanceRepairSource
	, authorRefinementGuidanceRepairAddedPaths
	, authorRefinementGuidanceRepairChangedPaths
	, authorRefinementGuidanceRepairHistoryPath
	, authorRefinementGuidanceRepairImplementation
	, authorRefinementGuidanceRepairIntegrationBase
	, authorRefinementGuidanceRepairIntegrationPaths
	, authorRefinementGuidanceRepairPredecessor
	, reverseAuthorRefinementGuidanceRepairUpdate
} from "./author-refinement-guidance-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Author refinement guidance repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		authorRefinementGuidanceRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "author-refinement-guidance-repair-source-v1");
	assert.equal(record.predecessorCommit
		, authorRefinementGuidanceRepairPredecessor);
	assert.equal(record.implementationCommit
		, authorRefinementGuidanceRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, authorRefinementGuidanceRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, authorRefinementGuidanceRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, authorRefinementGuidanceRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, authorRefinementGuidanceRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeAuthorRefinementGuidanceRepairSource);
		const previous = git(["show"
			, `${authorRefinementGuidanceRepairPredecessor}:${update.path}`]);
		assert.equal(reverseAuthorRefinementGuidanceRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeAuthorRefinementGuidanceRepairSource);
		const previous = git(["show"
			, `${authorRefinementGuidanceRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseAuthorRefinementGuidanceRepairUpdate(
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

test("Author refinement guidance repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${authorRefinementGuidanceRepairImplementation}^`]).trim()
	, authorRefinementGuidanceRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, authorRefinementGuidanceRepairPredecessor
		, authorRefinementGuidanceRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...authorRefinementGuidanceRepairChangedPaths].sort());
});

test("Author refinement guidance repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		authorRefinementGuidanceRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeAuthorRefinementGuidanceRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseAuthorRefinementGuidanceRepairUpdate(
		current, update));
});

test("Author refinement guidance writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-author-refinement-guidance-repair-history-"));
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
		"scripts/update-author-refinement-guidance-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
