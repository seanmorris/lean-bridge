/**
 * Authenticate the callback Subtype test-registration history.
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
	beforeCallbackSubtypeTestRegistrationSource
	, callbackSubtypeTestRegistrationAddedPaths
	, callbackSubtypeTestRegistrationHistoryPath
	, callbackSubtypeTestRegistrationImplementation
	, callbackSubtypeTestRegistrationImplementationPaths
	, callbackSubtypeTestRegistrationIntegrationPaths
	, callbackSubtypeTestRegistrationModifiedPaths
	, callbackSubtypeTestRegistrationPredecessor
	, reverseCallbackSubtypeTestRegistrationUpdate
} from "./callback-subtype-test-registration-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype test registration restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeTestRegistrationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-subtype-test-registration-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeTestRegistrationPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeTestRegistrationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeTestRegistrationModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeTestRegistrationIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeTestRegistrationAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCallbackSubtypeTestRegistrationSource);
		const previous = git(["show"
			, `${callbackSubtypeTestRegistrationPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeTestRegistrationUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCallbackSubtypeTestRegistrationSource);
		const previous = git(["show"
			, `${callbackSubtypeTestRegistrationImplementation}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeTestRegistrationUpdate(current, update)
			, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback Subtype test registration range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${callbackSubtypeTestRegistrationImplementation}^`]).trim()
	, callbackSubtypeTestRegistrationPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypeTestRegistrationPredecessor
		, callbackSubtypeTestRegistrationImplementation]).trim().split("\n").sort()
	, [...callbackSubtypeTestRegistrationImplementationPaths].sort());
});

test("callback Subtype test registration rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeTestRegistrationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCallbackSubtypeTestRegistrationSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCallbackSubtypeTestRegistrationUpdate(current, update));
});

test("callback Subtype test-registration writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-subtype-registration-history-"));
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
		"scripts/update-callback-subtype-test-registration-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
