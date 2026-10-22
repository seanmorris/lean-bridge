/**
 * Authenticate the complete zero-payload checked-record matrix closure.
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
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeZeroPayloadMatrixClosureSource
	, reverseZeroPayloadMatrixClosureUpdate
	, zeroPayloadMatrixClosureAddedPaths
	, zeroPayloadMatrixClosureHistoryPath
	, zeroPayloadMatrixClosureImplementation
	, zeroPayloadMatrixClosureImplementationAdditions
	, zeroPayloadMatrixClosureImplementationPaths
	, zeroPayloadMatrixClosureIntegrationPaths
	, zeroPayloadMatrixClosureModifiedPaths
	, zeroPayloadMatrixClosurePredecessor
} from "./zero-payload-matrix-closure-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("zero-payload matrix closure restores every modified source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadMatrixClosureHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "zero-payload-checked-record-matrix-closure-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadMatrixClosurePredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadMatrixClosureImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadMatrixClosureModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadMatrixClosureIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, zeroPayloadMatrixClosureAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeZeroPayloadMatrixClosureSource);
		const previous = git(["show"
			, `${zeroPayloadMatrixClosurePredecessor}:${update.path}`]);
		assert.equal(reverseZeroPayloadMatrixClosureUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeZeroPayloadMatrixClosureSource);
		const previous = git(["show"
			, `${zeroPayloadMatrixClosureImplementation}:${update.path}`]);
		assert.equal(reverseZeroPayloadMatrixClosureUpdate(current, update)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("zero-payload matrix closure range and additions are exact", () => {
	assert.equal(git(["rev-parse"
		, `${zeroPayloadMatrixClosureImplementation}^`]).trim()
	, zeroPayloadMatrixClosurePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, zeroPayloadMatrixClosurePredecessor
		, zeroPayloadMatrixClosureImplementation]).trim().split("\n").sort()
	, [...zeroPayloadMatrixClosureImplementationPaths].sort());
	for(const path of zeroPayloadMatrixClosureImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, zeroPayloadMatrixClosurePredecessor, "--", path]).trim(), "");
		assert.notEqual(git(["ls-tree", "--name-only"
			, zeroPayloadMatrixClosureImplementation, "--", path]).trim(), "");
	}
});

test("zero-payload matrix closure rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadMatrixClosureHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeZeroPayloadMatrixClosureSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseZeroPayloadMatrixClosureUpdate(current, update));
});

test("zero-payload matrix closure writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-zero-payload-matrix-closure-history-"));
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
		"scripts/update-zero-payload-matrix-closure-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
