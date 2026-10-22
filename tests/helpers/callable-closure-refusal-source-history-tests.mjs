/**
 * Authenticate returned-closure refusal-diagnostic source history.
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
	beforeCallableClosureRefusalSource, callableClosureRefusalAddedPaths
	, callableClosureRefusalChangedPaths, callableClosureRefusalHistoryPath
	, callableClosureRefusalImplementation
	, callableClosureRefusalImplementationPaths
	, callableClosureRefusalPredecessor, reverseCallableClosureRefusalUpdate
} from "./callable-closure-refusal-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("returned-closure refusal history restores every source", async () => {
	const record = JSON.parse(await readFile(callableClosureRefusalHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callable-closure-refusal-v1");
	assert.equal(record.predecessorCommit, callableClosureRefusalPredecessor);
	assert.equal(record.implementationCommit, callableClosureRefusalImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callableClosureRefusalChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, callableClosureRefusalAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCallableClosureRefusalSource);
		const previous = git(["show"
			, `${callableClosureRefusalPredecessor}:${update.path}`]);
		assert.equal(reverseCallableClosureRefusalUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCallableClosureRefusalSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(update.path, current
			, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path), update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("returned-closure refusal implementation range is exact", () => {
	assert.equal(git(["rev-parse", `${callableClosureRefusalImplementation}^`]).trim()
		, callableClosureRefusalPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, callableClosureRefusalPredecessor
		, callableClosureRefusalImplementation]).trim().split("\n").sort()
	, [...callableClosureRefusalImplementationPaths].sort());
});

test("returned-closure refusal history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(callableClosureRefusalHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeCallableClosureRefusalSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallableClosureRefusalUpdate(current, update));
	const edited = structuredClone(record.updates[0]);
	edited.edits[0].current += "x";
	assert.throws(() => reverseCallableClosureRefusalUpdate(current, edited));
	const unknown = structuredClone(record.updates[0]);
	unknown.path = "src/not-recorded.mjs";
	assert.throws(() => reverseCallableClosureRefusalUpdate(current, unknown));
	assert.equal(beforeCallableClosureRefusalSource(update.path, `${current}\n`)
		, `${current}\n`);
});

test("returned-closure refusal history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callable-closure-refusal-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callable-closure-refusal-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
