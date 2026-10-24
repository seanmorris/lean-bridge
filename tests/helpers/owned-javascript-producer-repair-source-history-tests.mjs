/**
 * Authenticate the explicit Owned JavaScript producer repair.
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
	beforeOwnedJavaScriptProducerRepairSource
	, ownedJavaScriptProducerRepairAddedPaths
	, ownedJavaScriptProducerRepairChangedPaths
	, ownedJavaScriptProducerRepairFollowup
	, ownedJavaScriptProducerRepairFollowupPaths
	, ownedJavaScriptProducerRepairHistoryPath
	, ownedJavaScriptProducerRepairImplementation
	, ownedJavaScriptProducerRepairIntegrationBase
	, ownedJavaScriptProducerRepairIntegrationPaths
	, ownedJavaScriptProducerRepairPredecessor
	, reverseOwnedJavaScriptProducerRepairUpdate
} from "./owned-javascript-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Owned JavaScript producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedJavaScriptProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-javascript-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, ownedJavaScriptProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedJavaScriptProducerRepairImplementation);
	assert.equal(record.followupImplementationCommit
		, ownedJavaScriptProducerRepairFollowup);
	assert.equal(record.integrationBaseCommit
		, ownedJavaScriptProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedJavaScriptProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedJavaScriptProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedJavaScriptProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedJavaScriptProducerRepairSource);
		const previous = git(["show"
			, `${ownedJavaScriptProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedJavaScriptProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedJavaScriptProducerRepairSource);
		const previous = git(["show"
			, `${ownedJavaScriptProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseOwnedJavaScriptProducerRepairUpdate(
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

test("Owned JavaScript producer repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${ownedJavaScriptProducerRepairImplementation}^`]).trim()
	, ownedJavaScriptProducerRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedJavaScriptProducerRepairPredecessor
		, ownedJavaScriptProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...ownedJavaScriptProducerRepairChangedPaths].sort());
});

test("Owned JavaScript producer follow-up matches its exact commit", async () => {
	assert.equal(git(["rev-parse", `${ownedJavaScriptProducerRepairFollowup}^`]).trim()
		, ownedJavaScriptProducerRepairImplementation);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedJavaScriptProducerRepairImplementation
		, ownedJavaScriptProducerRepairFollowup]).trim().split("\n").filter(Boolean).sort()
	, [...ownedJavaScriptProducerRepairFollowupPaths].sort());
	const record = JSON.parse(await readFile(ownedJavaScriptProducerRepairHistoryPath, "utf8"));
	for(const path of ownedJavaScriptProducerRepairFollowupPaths)
	{
		const update = record.integrationUpdates.find(item => item.path === path);
		assert.ok(update, path);
		const current = await sourceAtFinHistoryMilestone(path, update.currentSha256);
		assert.equal(current, git(["show", `${ownedJavaScriptProducerRepairFollowup}:${path}`]), path);
	}
});

test("Owned JavaScript producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedJavaScriptProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeOwnedJavaScriptProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedJavaScriptProducerRepairUpdate(
		current, update));
});

test("Owned JavaScript producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-javascript-producer-repair-history-"));
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
		"scripts/update-owned-javascript-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
