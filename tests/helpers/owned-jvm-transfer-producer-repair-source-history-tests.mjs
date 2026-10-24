/**
 * Authenticate the explicit Owned JVM transfer producer repair.
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
	beforeOwnedJvmTransferProducerRepairSource
	, ownedJvmTransferProducerRepairAddedPaths
	, ownedJvmTransferProducerRepairChangedPaths
	, ownedJvmTransferProducerRepairHistoryPath
	, ownedJvmTransferProducerRepairImplementation
	, ownedJvmTransferProducerRepairIntegrationBase
	, ownedJvmTransferProducerRepairIntegrationPaths
	, ownedJvmTransferProducerRepairPredecessor
	, reverseOwnedJvmTransferProducerRepairUpdate
} from "./owned-jvm-transfer-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Owned JVM transfer producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedJvmTransferProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-jvm-transfer-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, ownedJvmTransferProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedJvmTransferProducerRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, ownedJvmTransferProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedJvmTransferProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedJvmTransferProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedJvmTransferProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedJvmTransferProducerRepairSource);
		const previous = git(["show"
			, `${ownedJvmTransferProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseOwnedJvmTransferProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedJvmTransferProducerRepairSource);
		const previous = git(["show"
			, `${ownedJvmTransferProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseOwnedJvmTransferProducerRepairUpdate(
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

test("Owned JVM transfer producer repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${ownedJvmTransferProducerRepairImplementation}^`]).trim()
	, ownedJvmTransferProducerRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedJvmTransferProducerRepairPredecessor
		, ownedJvmTransferProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...ownedJvmTransferProducerRepairChangedPaths].sort());
});

test("Owned JVM transfer producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedJvmTransferProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeOwnedJvmTransferProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedJvmTransferProducerRepairUpdate(
		current, update));
});

test("Owned JVM transfer producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-owned-jvm-transfer-producer-repair-history-"));
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
		"scripts/update-owned-jvm-transfer-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
