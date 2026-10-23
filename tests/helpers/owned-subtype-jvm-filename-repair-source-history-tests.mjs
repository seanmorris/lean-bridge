/**
 * Authenticate the owned-Subtype JVM consumer filename repair.
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
	beforeOwnedSubtypeJvmFilenameRepairSource
	, ownedSubtypeJvmFilenameRepairAddedPaths
	, ownedSubtypeJvmFilenameRepairHistoryPath
	, ownedSubtypeJvmFilenameRepairImplementation
	, ownedSubtypeJvmFilenameRepairImplementationPaths
	, ownedSubtypeJvmFilenameRepairIntegrationPaths
	, ownedSubtypeJvmFilenameRepairPredecessor
	, reverseOwnedSubtypeJvmFilenameRepairUpdate
} from "./owned-subtype-jvm-filename-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype JVM filename history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeJvmFilenameRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-jvm-filename-repair-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypeJvmFilenameRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeJvmFilenameRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeJvmFilenameRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeJvmFilenameRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeJvmFilenameRepairAddedPaths);
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedSubtypeJvmFilenameRepairSource);
		const base = record.updates.includes(update)
			? ownedSubtypeJvmFilenameRepairPredecessor
			: ownedSubtypeJvmFilenameRepairImplementation;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeJvmFilenameRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("owned Subtype JVM filename history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypeJvmFilenameRepairImplementation}^`]).trim()
	, ownedSubtypeJvmFilenameRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeJvmFilenameRepairPredecessor
		, ownedSubtypeJvmFilenameRepairImplementation]).trim()
		.split("\n").sort()
	, [...ownedSubtypeJvmFilenameRepairImplementationPaths].sort());
});

test("owned Subtype JVM filename history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeJvmFilenameRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedSubtypeJvmFilenameRepairSource);
	assert.throws(() => reverseOwnedSubtypeJvmFilenameRepairUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseOwnedSubtypeJvmFilenameRepairUpdate(current
		, { ...update, path: "unknown.mjs" }));
	assert.equal(beforeOwnedSubtypeJvmFilenameRepairSource(
		update.path, `${current}unknown`), `${current}unknown`);
});

test("owned Subtype JVM filename writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-owned-subtype-jvm-filename-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-jvm-filename-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
