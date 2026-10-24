/**
 * Authenticate the remaining owned Subtype hosted-lane TAP repair.
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
	beforeOwnedSubtypeRemainingHostsTapRepairSource
	, ownedSubtypeRemainingHostsTapRepairAddedPaths
	, ownedSubtypeRemainingHostsTapRepairChangedPaths
	, ownedSubtypeRemainingHostsTapRepairHistoryPath
	, ownedSubtypeRemainingHostsTapRepairImplementation
	, ownedSubtypeRemainingHostsTapRepairIntegrationPaths
	, ownedSubtypeRemainingHostsTapRepairPredecessor
	, reverseOwnedSubtypeRemainingHostsTapRepairUpdate
} from "./owned-subtype-remaining-hosts-tap-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("remaining owned Subtype TAP repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeRemainingHostsTapRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-subtype-remaining-hosts-tap-repair-source-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypeRemainingHostsTapRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeRemainingHostsTapRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeRemainingHostsTapRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeRemainingHostsTapRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeRemainingHostsTapRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypeRemainingHostsTapRepairSource);
		const previous = git(["show"
			, `${ownedSubtypeRemainingHostsTapRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeRemainingHostsTapRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypeRemainingHostsTapRepairSource);
		const previous = git(["show"
			, `${ownedSubtypeRemainingHostsTapRepairImplementation}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeRemainingHostsTapRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("remaining owned Subtype TAP repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeRemainingHostsTapRepairImplementation}^`]).trim()
	, ownedSubtypeRemainingHostsTapRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeRemainingHostsTapRepairPredecessor
		, ownedSubtypeRemainingHostsTapRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...ownedSubtypeRemainingHostsTapRepairChangedPaths].sort());
});

test("remaining owned Subtype TAP history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeRemainingHostsTapRepairHistoryPath, "utf8"));
	for(const original of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(original.path
			, original.currentSha256
			, beforeOwnedSubtypeRemainingHostsTapRepairSource);
		const update = structuredClone(original);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseOwnedSubtypeRemainingHostsTapRepairUpdate(
			current, update), original.path);
	}
});

test("remaining owned Subtype TAP writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-subtype-remaining-tap-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-remaining-hosts-tap-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
