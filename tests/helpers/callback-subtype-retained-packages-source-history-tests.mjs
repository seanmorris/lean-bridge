/**
 * Authenticate the callback Subtype retained package change.
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
	beforeCallbackSubtypeRetainedPackagesSource
	, callbackSubtypeRetainedPackagesAddedPaths
	, callbackSubtypeRetainedPackagesHistoryPath
	, callbackSubtypeRetainedPackagesImplementation
	, callbackSubtypeRetainedPackagesImplementationPaths
	, callbackSubtypeRetainedPackagesIntegrationPaths
	, callbackSubtypeRetainedPackagesModifiedPaths
	, callbackSubtypeRetainedPackagesPredecessor
	, reverseCallbackSubtypeRetainedPackagesUpdate
} from "./callback-subtype-retained-packages-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype retained package history restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeRetainedPackagesHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-subtype-retained-packages-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeRetainedPackagesPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeRetainedPackagesImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeRetainedPackagesModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeRetainedPackagesIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeRetainedPackagesAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeRetainedPackagesSource);
		const previous = git(["show"
			, `${callbackSubtypeRetainedPackagesPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeRetainedPackagesUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeRetainedPackagesSource);
		const previous = git(["show"
			, `${callbackSubtypeRetainedPackagesImplementation}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeRetainedPackagesUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback Subtype retained package history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackSubtypeRetainedPackagesImplementation}^`]).trim()
	, callbackSubtypeRetainedPackagesPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypeRetainedPackagesPredecessor
		, callbackSubtypeRetainedPackagesImplementation]).trim().split("\n").sort()
	, [...callbackSubtypeRetainedPackagesImplementationPaths].sort());
});

test("callback Subtype retained package history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeRetainedPackagesHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackSubtypeRetainedPackagesSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCallbackSubtypeRetainedPackagesUpdate(current, update));
});

test("callback Subtype retained package history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-subtype-retained-packages-history-"));
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
		"scripts/update-callback-subtype-retained-packages-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
