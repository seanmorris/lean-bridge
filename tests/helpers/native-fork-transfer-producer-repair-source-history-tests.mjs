/**
 * Authenticate the explicit Native fork and transfer producer repair.
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
	beforeNativeForkTransferProducerRepairSource
	, nativeForkTransferProducerRepairAddedPaths
	, nativeForkTransferProducerRepairChangedPaths
	, nativeForkTransferProducerRepairHistoryPath
	, nativeForkTransferProducerRepairImplementation
	, nativeForkTransferProducerRepairForkImplementation
	, nativeForkTransferProducerRepairForkPaths
	, nativeForkTransferProducerRepairTransferImplementation
	, nativeForkTransferProducerRepairTransferPaths
	, nativeForkTransferProducerRepairIntegrationBase
	, nativeForkTransferProducerRepairIntegrationPaths
	, nativeForkTransferProducerRepairPredecessor
	, reverseNativeForkTransferProducerRepairUpdate
} from "./native-fork-transfer-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Native fork and transfer producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		nativeForkTransferProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "native-fork-transfer-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, nativeForkTransferProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, nativeForkTransferProducerRepairImplementation);
	assert.equal(record.forkImplementationCommit, nativeForkTransferProducerRepairForkImplementation);
	assert.equal(record.transferImplementationCommit, nativeForkTransferProducerRepairTransferImplementation);
	assert.equal(record.integrationBaseCommit
		, nativeForkTransferProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, nativeForkTransferProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, nativeForkTransferProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, nativeForkTransferProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeNativeForkTransferProducerRepairSource);
		const previous = git(["show"
			, `${nativeForkTransferProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseNativeForkTransferProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeNativeForkTransferProducerRepairSource);
		const previous = git(["show"
			, `${nativeForkTransferProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseNativeForkTransferProducerRepairUpdate(
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

test("Native fork and transfer producer repair merges two exact source commits", () => {
	assert.equal(git(["rev-parse", `${nativeForkTransferProducerRepairImplementation}^`]).trim()
		, nativeForkTransferProducerRepairForkImplementation);
	assert.equal(git(["rev-parse", `${nativeForkTransferProducerRepairImplementation}^2`]).trim()
		, nativeForkTransferProducerRepairTransferImplementation);
	for(const [commit, paths] of [
		[nativeForkTransferProducerRepairForkImplementation, nativeForkTransferProducerRepairForkPaths]
		, [nativeForkTransferProducerRepairTransferImplementation, nativeForkTransferProducerRepairTransferPaths]
	]) {
		assert.equal(git(["rev-parse", `${commit}^`]).trim(), nativeForkTransferProducerRepairPredecessor);
		assert.deepEqual(git(["diff", "--name-only", nativeForkTransferProducerRepairPredecessor, commit])
			.trim().split("\n").filter(Boolean).sort(), [...paths].sort());
		for(const path of paths)
			assert.equal(git(["show", `${nativeForkTransferProducerRepairImplementation}:${path}`])
				, git(["show", `${commit}:${path}`]), path);
	}
	assert.deepEqual(git(["diff", "--name-only"
		, nativeForkTransferProducerRepairPredecessor
		, nativeForkTransferProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...nativeForkTransferProducerRepairChangedPaths].sort());
});

test("Native fork and transfer producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		nativeForkTransferProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeNativeForkTransferProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseNativeForkTransferProducerRepairUpdate(
		current, update));
});

test("Native fork and transfer producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-native-fork-transfer-producer-repair-history-"));
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
		"scripts/update-native-fork-transfer-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
