/**
 * Authenticate the owned lifetime producer replay history.
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
	beforeOwnedLifetimeReplaySource
	, ownedLifetimeReplayAddedPaths
	, ownedLifetimeReplayHistoryPath
	, ownedLifetimeReplayImplementation
	, ownedLifetimeReplayImplementationPaths
	, ownedLifetimeReplayIntegrationPaths
	, ownedLifetimeReplayModifiedPaths
	, ownedLifetimeReplayPredecessor
	, reverseOwnedLifetimeReplayUpdate
} from "./owned-lifetime-producer-replay-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });

test("owned lifetime producer replay history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedLifetimeReplayHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-lifetime-producer-replay-source-v1");
	assert.equal(record.predecessorCommit
		, ownedLifetimeReplayPredecessor);
	assert.equal(record.implementationCommit
		, ownedLifetimeReplayImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedLifetimeReplayModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedLifetimeReplayIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedLifetimeReplayAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedLifetimeReplaySource);
		const previous = git(["show"
			, `${ownedLifetimeReplayPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedLifetimeReplayUpdate(
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
			, beforeOwnedLifetimeReplaySource);
		const previous = git(["show"
			, `${ownedLifetimeReplayImplementation}:${update.path}`]);
		assert.equal(reverseOwnedLifetimeReplayUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned lifetime producer replay history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedLifetimeReplayImplementation}^`]).trim()
	, ownedLifetimeReplayPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedLifetimeReplayPredecessor
		, ownedLifetimeReplayImplementation])
		.trim().split("\n").sort()
	, [...ownedLifetimeReplayImplementationPaths].sort());
});

test("owned lifetime producer replay history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedLifetimeReplayHistoryPath, "utf8"));
	const update = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeOwnedLifetimeReplaySource);
	assert.equal(beforeOwnedLifetimeReplaySource(update.path, current, update.currentSha256)
		, current);
	assert.equal(sha256(beforeOwnedLifetimeReplaySource(update.path, current, update.previousSha256))
		, update.previousSha256);
	const unknown = current + "\n/* unrelated bytes */\n";
	assert.equal(beforeOwnedLifetimeReplaySource(update.path, unknown, update.previousSha256), unknown);
	for(const key of ["currentSha256", "previousSha256"])
		assert.throws(() => reverseOwnedLifetimeReplayUpdate(current, {
			...update, [key]: "0".repeat(64)
		}));
});

test("owned lifetime producer replay history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-lifetime-producer-replay-"));
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
		"scripts/update-owned-lifetime-producer-replay-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
