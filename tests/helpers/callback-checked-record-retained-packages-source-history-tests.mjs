/**
 * Authenticate the callback checked-record retained package change.
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
	beforeCallbackCheckedRecordRetainedPackagesSource
	, callbackCheckedRecordRetainedPackagesAddedPaths
	, callbackCheckedRecordRetainedPackagesHistoryPath
	, callbackCheckedRecordRetainedPackagesImplementation
	, callbackCheckedRecordRetainedPackagesImplementationPaths
	, callbackCheckedRecordRetainedPackagesIntegrationPaths
	, callbackCheckedRecordRetainedPackagesModifiedPaths
	, callbackCheckedRecordRetainedPackagesPredecessor
	, reverseCallbackCheckedRecordRetainedPackagesUpdate
} from "./callback-checked-record-retained-packages-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback checked-record retained package history restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordRetainedPackagesHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-checked-record-retained-packages-v1");
	assert.equal(record.predecessorCommit
		, callbackCheckedRecordRetainedPackagesPredecessor);
	assert.equal(record.implementationCommit
		, callbackCheckedRecordRetainedPackagesImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackCheckedRecordRetainedPackagesModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackCheckedRecordRetainedPackagesIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackCheckedRecordRetainedPackagesAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackCheckedRecordRetainedPackagesSource);
		const previous = git(["show"
			, `${callbackCheckedRecordRetainedPackagesPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackCheckedRecordRetainedPackagesUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackCheckedRecordRetainedPackagesSource);
		const previous = git(["show"
			, `${callbackCheckedRecordRetainedPackagesImplementation}:${update.path}`]);
		assert.equal(reverseCallbackCheckedRecordRetainedPackagesUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback checked-record retained package history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackCheckedRecordRetainedPackagesImplementation}^`]).trim()
	, callbackCheckedRecordRetainedPackagesPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackCheckedRecordRetainedPackagesPredecessor
		, callbackCheckedRecordRetainedPackagesImplementation]).trim().split("\n").sort()
	, [...callbackCheckedRecordRetainedPackagesImplementationPaths].sort());
});

test("callback checked-record retained package history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordRetainedPackagesHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackCheckedRecordRetainedPackagesSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCallbackCheckedRecordRetainedPackagesUpdate(current, update));
});

test("callback checked-record retained package history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-checked-record-retained-packages-history-"));
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
		"scripts/update-callback-checked-record-retained-packages-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
