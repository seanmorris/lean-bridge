/**
 * Authenticate the explicit Owned .NET producer repair.
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
	beforeOwnedDotnetProducerRepairSource
	, ownedDotnetProducerRepairAddedPaths
	, ownedDotnetProducerRepairChangedPaths
	, ownedDotnetProducerRepairFollowup
	, ownedDotnetProducerRepairFollowupPaths
	, ownedDotnetProducerRepairHistoryPath
	, ownedDotnetProducerRepairImplementation
	, ownedDotnetProducerRepairIntegrationBase
	, ownedDotnetProducerRepairIntegrationPaths
	, ownedDotnetProducerRepairPredecessor
	, reverseOwnedDotnetProducerRepairUpdate
} from "./owned-dotnet-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Owned .NET producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedDotnetProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-dotnet-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, ownedDotnetProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedDotnetProducerRepairImplementation);
	assert.equal(record.followupImplementationCommit
		, ownedDotnetProducerRepairFollowup);
	assert.equal(record.integrationBaseCommit
		, ownedDotnetProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedDotnetProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedDotnetProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedDotnetProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedDotnetProducerRepairSource);
		const previous = git(["show"
			, `${ownedDotnetProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedDotnetProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedDotnetProducerRepairSource);
		const previous = git(["show"
			, `${ownedDotnetProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseOwnedDotnetProducerRepairUpdate(
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

test("Owned .NET producer repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${ownedDotnetProducerRepairImplementation}^`]).trim()
	, ownedDotnetProducerRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedDotnetProducerRepairPredecessor
		, ownedDotnetProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...ownedDotnetProducerRepairChangedPaths].sort());
});

test("Owned .NET producer stop repair matches its exact follow-up commit", async () => {
	assert.equal(git(["rev-parse", `${ownedDotnetProducerRepairFollowup}^`]).trim()
		, ownedDotnetProducerRepairImplementation);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedDotnetProducerRepairImplementation
		, ownedDotnetProducerRepairFollowup]).trim().split("\n").filter(Boolean).sort()
	, [...ownedDotnetProducerRepairFollowupPaths].sort());
	const record = JSON.parse(await readFile(ownedDotnetProducerRepairHistoryPath, "utf8"));
	for(const path of ownedDotnetProducerRepairFollowupPaths)
	{
		const update = record.integrationUpdates.find(item => item.path === path);
		assert.ok(update, path);
		const current = await sourceAtFinHistoryMilestone(path, update.currentSha256);
		assert.equal(current, git(["show", `${ownedDotnetProducerRepairFollowup}:${path}`]), path);
	}
});

test("Owned .NET producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedDotnetProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeOwnedDotnetProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedDotnetProducerRepairUpdate(
		current, update));
});

test("Owned .NET producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-dotnet-producer-repair-history-"));
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
		"scripts/update-owned-dotnet-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
