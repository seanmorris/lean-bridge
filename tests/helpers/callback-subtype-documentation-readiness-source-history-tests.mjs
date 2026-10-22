/**
 * Authenticate the callback Subtype documentation-readiness history.
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
	beforeCallbackSubtypeDocumentationReadinessSource
	, callbackSubtypeDocumentationReadinessAddedPaths
	, callbackSubtypeDocumentationReadinessCommits
	, callbackSubtypeDocumentationReadinessHistoryPath
	, callbackSubtypeDocumentationReadinessImplementation
	, callbackSubtypeDocumentationReadinessImplementationPaths
	, callbackSubtypeDocumentationReadinessIntegrationPaths
	, callbackSubtypeDocumentationReadinessModifiedPaths
	, callbackSubtypeDocumentationReadinessPredecessor
	, reverseCallbackSubtypeDocumentationReadinessUpdate
} from "./callback-subtype-documentation-readiness-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback Subtype documentation readiness restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeDocumentationReadinessHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-subtype-documentation-readiness-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeDocumentationReadinessPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeDocumentationReadinessImplementation);
	assert.deepEqual(record.implementationCommits
		, callbackSubtypeDocumentationReadinessCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeDocumentationReadinessModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeDocumentationReadinessIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callbackSubtypeDocumentationReadinessAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeDocumentationReadinessSource);
		const previous = git(["show"
			, `${callbackSubtypeDocumentationReadinessPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeDocumentationReadinessUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeCallbackSubtypeDocumentationReadinessSource);
		const previous = git(["show"
			, `${callbackSubtypeDocumentationReadinessImplementation}:${update.path}`]);
		assert.equal(reverseCallbackSubtypeDocumentationReadinessUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("callback Subtype documentation readiness range is exact", () => {
	assert.deepEqual(git(["rev-list", "--reverse", "--ancestry-path"
		, `${callbackSubtypeDocumentationReadinessPredecessor}..${callbackSubtypeDocumentationReadinessImplementation}`]).trim().split("\n")
	, callbackSubtypeDocumentationReadinessCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, callbackSubtypeDocumentationReadinessPredecessor
		, callbackSubtypeDocumentationReadinessImplementation]).trim().split("\n").sort()
	, [...callbackSubtypeDocumentationReadinessImplementationPaths].sort());
});

test("callback Subtype documentation readiness rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeDocumentationReadinessHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeCallbackSubtypeDocumentationReadinessSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseCallbackSubtypeDocumentationReadinessUpdate(current, update));
});

test("callback Subtype documentation writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-subtype-docs-history-"));
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
		"scripts/update-callback-subtype-documentation-readiness-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
