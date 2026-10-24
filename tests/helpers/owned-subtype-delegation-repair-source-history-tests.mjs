/**
 * Authenticate the explicit Owned Subtype delegation repair.
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
	beforeOwnedSubtypeDelegationRepairSource
	, ownedSubtypeDelegationRepairAddedPaths
	, ownedSubtypeDelegationRepairChangedPaths
	, ownedSubtypeDelegationRepairFollowup
	, ownedSubtypeDelegationRepairFollowupPredecessor
	, ownedSubtypeDelegationRepairFollowupPaths
	, ownedSubtypeDelegationRepairHistoryPath
	, ownedSubtypeDelegationRepairImplementation
	, ownedSubtypeDelegationRepairIntegrationBase
	, ownedSubtypeDelegationRepairIntegrationPaths
	, ownedSubtypeDelegationRepairPredecessor
	, reverseOwnedSubtypeDelegationRepairUpdate
} from "./owned-subtype-delegation-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Owned Subtype delegation repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeDelegationRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-subtype-delegation-repair-source-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypeDelegationRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeDelegationRepairImplementation);
	assert.equal(record.followupPredecessorCommit
		, ownedSubtypeDelegationRepairFollowupPredecessor);
	assert.equal(record.followupImplementationCommit
		, ownedSubtypeDelegationRepairFollowup);
	assert.equal(record.integrationBaseCommit
		, ownedSubtypeDelegationRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeDelegationRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeDelegationRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeDelegationRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedSubtypeDelegationRepairSource);
		const previous = git(["show"
			, `${ownedSubtypeDelegationRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeDelegationRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedSubtypeDelegationRepairSource);
		const previous = git(["show"
			, `${ownedSubtypeDelegationRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeDelegationRepairUpdate(
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

test("Owned Subtype delegation repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeDelegationRepairImplementation}^`]).trim()
	, ownedSubtypeDelegationRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeDelegationRepairPredecessor
		, ownedSubtypeDelegationRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...ownedSubtypeDelegationRepairChangedPaths].sort());
});

test("Owned Subtype delegation follow-ups match their exact commit chain", async () => {
	assert.equal(git(["rev-parse", `${ownedSubtypeDelegationRepairFollowupPredecessor}^`]).trim()
		, ownedSubtypeDelegationRepairImplementation);
	assert.equal(git(["rev-parse", `${ownedSubtypeDelegationRepairFollowup}^`]).trim()
		, ownedSubtypeDelegationRepairFollowupPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeDelegationRepairImplementation
		, ownedSubtypeDelegationRepairFollowup]).trim().split("\n").filter(Boolean).sort()
	, [...ownedSubtypeDelegationRepairFollowupPaths].sort());
	const record = JSON.parse(await readFile(ownedSubtypeDelegationRepairHistoryPath, "utf8"));
	for(const path of ownedSubtypeDelegationRepairFollowupPaths)
	{
		const update = record.integrationUpdates.find(item => item.path === path);
		assert.ok(update, path);
		const current = await sourceAtFinHistoryMilestone(path, update.currentSha256);
		assert.equal(current, git(["show", `${ownedSubtypeDelegationRepairFollowup}:${path}`]), path);
	}
});

test("Owned Subtype delegation repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeDelegationRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeOwnedSubtypeDelegationRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeDelegationRepairUpdate(
		current, update));
});

test("Owned Subtype delegation writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-subtype-delegation-repair-history-"));
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
		"scripts/update-owned-subtype-delegation-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
