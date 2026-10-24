/**
 * Authenticate the explicit Owned C receiver producer repair.
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
	beforeOwnedCReceiverProducerRepairSource
	, ownedCReceiverProducerRepairAddedPaths
	, ownedCReceiverProducerRepairChangedPaths
	, ownedCReceiverProducerRepairHistoryPath
	, ownedCReceiverProducerRepairImplementation
	, ownedCReceiverProducerRepairIntegrationBase
	, ownedCReceiverProducerRepairIntegrationPaths
	, ownedCReceiverProducerRepairPredecessor
	, reverseOwnedCReceiverProducerRepairUpdate
} from "./owned-c-receiver-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Owned C receiver producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedCReceiverProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-c-receiver-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, ownedCReceiverProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedCReceiverProducerRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, ownedCReceiverProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedCReceiverProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedCReceiverProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedCReceiverProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedCReceiverProducerRepairSource);
		const previous = git(["show"
			, `${ownedCReceiverProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedCReceiverProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedCReceiverProducerRepairSource);
		const previous = git(["show"
			, `${ownedCReceiverProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseOwnedCReceiverProducerRepairUpdate(
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

test("Owned C receiver producer repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${ownedCReceiverProducerRepairImplementation}^`]).trim()
	, ownedCReceiverProducerRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedCReceiverProducerRepairPredecessor
		, ownedCReceiverProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...ownedCReceiverProducerRepairChangedPaths].sort());
});

test("Owned C receiver producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedCReceiverProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeOwnedCReceiverProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedCReceiverProducerRepairUpdate(
		current, update));
});

test("Owned C receiver producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-c-receiver-producer-repair-history-"));
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
		"scripts/update-owned-c-receiver-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
