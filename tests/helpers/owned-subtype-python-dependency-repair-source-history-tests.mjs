/**
 * Authenticate the owned-Subtype Python dependency-resolution repair.
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
	beforeOwnedSubtypePythonDependencyRepairSource
	, ownedSubtypePythonDependencyRepairAddedPaths
	, ownedSubtypePythonDependencyRepairHistoryPath
	, ownedSubtypePythonDependencyRepairImplementation
	, ownedSubtypePythonDependencyRepairImplementationPaths
	, ownedSubtypePythonDependencyRepairIntegrationPaths
	, ownedSubtypePythonDependencyRepairPredecessor
	, reverseOwnedSubtypePythonDependencyRepairUpdate
} from "./owned-subtype-python-dependency-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype Python dependency history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypePythonDependencyRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "owned-subtype-python-dependency-repair-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypePythonDependencyRepairPredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypePythonDependencyRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypePythonDependencyRepairImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypePythonDependencyRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypePythonDependencyRepairAddedPaths);
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeOwnedSubtypePythonDependencyRepairSource);
		const base = record.updates.includes(update)
			? ownedSubtypePythonDependencyRepairPredecessor
			: ownedSubtypePythonDependencyRepairImplementation;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseOwnedSubtypePythonDependencyRepairUpdate(
			current, update), previous, update.path);
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

test("owned Subtype Python dependency history range is exact", () => {
	assert.equal(git(["rev-parse"
		, `${ownedSubtypePythonDependencyRepairImplementation}^`]).trim()
	, ownedSubtypePythonDependencyRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypePythonDependencyRepairPredecessor
		, ownedSubtypePythonDependencyRepairImplementation]).trim()
		.split("\n").sort()
	, [...ownedSubtypePythonDependencyRepairImplementationPaths].sort());
});

test("owned Subtype Python dependency history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypePythonDependencyRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256
		, beforeOwnedSubtypePythonDependencyRepairSource);
	assert.throws(() => reverseOwnedSubtypePythonDependencyRepairUpdate(
		current, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseOwnedSubtypePythonDependencyRepairUpdate(
		current, { ...update, path: "unknown.mjs" }));
	assert.equal(beforeOwnedSubtypePythonDependencyRepairSource(
		update.path, `${current}unknown`), `${current}unknown`);
});

test("owned Subtype Python dependency writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-owned-subtype-python-dependency-guard-"));
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
		"scripts/update-owned-subtype-python-dependency-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
