/**
 * Authenticate the explicit Borrow/receiver producer repair.
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
	beforeBorrowReceiverProducerRepairSource
	, borrowReceiverProducerRepairAddedPaths
	, borrowReceiverProducerRepairChangedPaths
	, borrowReceiverProducerRepairCommits
	, borrowReceiverProducerRepairHistoryPath
	, borrowReceiverProducerRepairImplementation
	, borrowReceiverProducerRepairIntegrationBase
	, borrowReceiverProducerRepairIntegrationPaths
	, borrowReceiverProducerRepairPredecessor
	, reverseBorrowReceiverProducerRepairUpdate
} from "./borrow-receiver-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Borrow/receiver producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		borrowReceiverProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "borrow-receiver-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, borrowReceiverProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, borrowReceiverProducerRepairImplementation);
	assert.deepEqual(record.implementationCommits, borrowReceiverProducerRepairCommits);
	assert.equal(record.integrationBaseCommit
		, borrowReceiverProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, borrowReceiverProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, borrowReceiverProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, borrowReceiverProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeBorrowReceiverProducerRepairSource);
		const previous = git(["show"
			, `${borrowReceiverProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseBorrowReceiverProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeBorrowReceiverProducerRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeBorrowReceiverProducerRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeBorrowReceiverProducerRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeBorrowReceiverProducerRepairSource);
		const previous = git(["show"
			, `${borrowReceiverProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseBorrowReceiverProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeBorrowReceiverProducerRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeBorrowReceiverProducerRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeBorrowReceiverProducerRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Borrow/receiver producer repair retains the exact three-commit range", () => {
	const predecessor = borrowReceiverProducerRepairPredecessor;
	const implementation = borrowReceiverProducerRepairImplementation;
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${predecessor}..${implementation}`]).trim().split("\n")
	, borrowReceiverProducerRepairCommits);
	for(const [index, revision] of borrowReceiverProducerRepairCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? predecessor : borrowReceiverProducerRepairCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, borrowReceiverProducerRepairPredecessor
		, borrowReceiverProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...borrowReceiverProducerRepairChangedPaths].sort());
});

test("Borrow/receiver producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		borrowReceiverProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeBorrowReceiverProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseBorrowReceiverProducerRepairUpdate(
		current, update));
});

test("Borrow/receiver producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-borrow-receiver-producer-repair-history-"));
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
		"scripts/update-borrow-receiver-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
