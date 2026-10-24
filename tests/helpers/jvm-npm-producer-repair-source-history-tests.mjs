/**
 * Authenticate the explicit JVM/npm producer repair.
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
	beforeJvmNpmProducerRepairSource
	, jvmNpmProducerRepairAddedPaths
	, jvmNpmProducerRepairChangedPaths
	, jvmNpmProducerRepairCommits
	, jvmNpmProducerRepairHistoryPath
	, jvmNpmProducerRepairImplementation
	, jvmNpmProducerRepairIntegrationBase
	, jvmNpmProducerRepairIntegrationPaths
	, jvmNpmProducerRepairPredecessor
	, reverseJvmNpmProducerRepairUpdate
} from "./jvm-npm-producer-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("JVM/npm producer repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		jvmNpmProducerRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "jvm-npm-producer-repair-source-v1");
	assert.equal(record.predecessorCommit
		, jvmNpmProducerRepairPredecessor);
	assert.equal(record.implementationCommit
		, jvmNpmProducerRepairImplementation);
	assert.deepEqual(record.implementationCommits, jvmNpmProducerRepairCommits);
	assert.equal(record.integrationBaseCommit
		, jvmNpmProducerRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, jvmNpmProducerRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, jvmNpmProducerRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, jvmNpmProducerRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeJvmNpmProducerRepairSource);
		const previous = git(["show"
			, `${jvmNpmProducerRepairPredecessor}:${update.path}`]);
		assert.equal(reverseJvmNpmProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeJvmNpmProducerRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeJvmNpmProducerRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeJvmNpmProducerRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeJvmNpmProducerRepairSource);
		const previous = git(["show"
			, `${jvmNpmProducerRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseJvmNpmProducerRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeJvmNpmProducerRepairSource(update.path, current, update.currentSha256), current);
		assert.equal(beforeJvmNpmProducerRepairSource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeJvmNpmProducerRepairSource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("JVM/npm producer repair retains the exact two-commit range", () => {
	const predecessor = jvmNpmProducerRepairPredecessor;
	const implementation = jvmNpmProducerRepairImplementation;
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${predecessor}..${implementation}`]).trim().split("\n")
	, jvmNpmProducerRepairCommits);
	for(const [index, revision] of jvmNpmProducerRepairCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? predecessor : jvmNpmProducerRepairCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, jvmNpmProducerRepairPredecessor
		, jvmNpmProducerRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...jvmNpmProducerRepairChangedPaths].sort());
});

test("JVM/npm producer repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		jvmNpmProducerRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeJvmNpmProducerRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseJvmNpmProducerRepairUpdate(
		current, update));
});

test("JVM/npm producer writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-jvm-npm-producer-repair-history-"));
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
		"scripts/update-jvm-npm-producer-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
