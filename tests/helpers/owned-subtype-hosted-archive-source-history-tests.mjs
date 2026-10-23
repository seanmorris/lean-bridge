/**
 * Authenticate the owned-Subtype hosted-archive foundation.
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
	beforeOwnedSubtypeHostedArchiveSource
	, ownedSubtypeHostedArchiveAddedPaths
	, ownedSubtypeHostedArchiveCommits
	, ownedSubtypeHostedArchiveHistoryPath
	, ownedSubtypeHostedArchiveImplementation
	, ownedSubtypeHostedArchiveImplementationAdditions
	, ownedSubtypeHostedArchiveImplementationPaths
	, ownedSubtypeHostedArchiveIntegrationPaths
	, ownedSubtypeHostedArchiveModifiedPaths
	, ownedSubtypeHostedArchivePredecessor
	, reverseOwnedSubtypeHostedArchiveUpdate
} from "./owned-subtype-hosted-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("owned Subtype hosted-archive history restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeHostedArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "owned-subtype-hosted-archive-v1");
	assert.equal(record.predecessorCommit, ownedSubtypeHostedArchivePredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeHostedArchiveImplementation);
	assert.deepEqual(record.implementationCommits
		, ownedSubtypeHostedArchiveCommits);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeHostedArchiveModifiedPaths);
	assert.deepEqual(record.implementationAdditions.map(item => item.path)
		, ownedSubtypeHostedArchiveImplementationAdditions);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeHostedArchiveIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, ownedSubtypeHostedArchiveAddedPaths);
	for(const update of [...record.updates, ...record.integrationUpdates])
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeOwnedSubtypeHostedArchiveSource);
		const base = record.updates.includes(update)
			? ownedSubtypeHostedArchivePredecessor
			: ownedSubtypeHostedArchiveImplementation;
		const previous = git(["show", `${base}:${update.path}`]);
		assert.equal(reverseOwnedSubtypeHostedArchiveUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of [
		...record.implementationAdditions, ...record.additions
	]) assert.equal(sha256(await sourceAtFinHistoryMilestone(
		addition.path, addition.currentSha256))
	, addition.currentSha256, addition.path);
});

test("owned Subtype hosted-archive history range is exact", () => {
	assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
		, `${ownedSubtypeHostedArchivePredecessor}..${ownedSubtypeHostedArchiveImplementation}`])
		.trim().split("\n"), ownedSubtypeHostedArchiveCommits);
	assert.deepEqual(git(["diff", "--name-only"
		, ownedSubtypeHostedArchivePredecessor
		, ownedSubtypeHostedArchiveImplementation]).trim().split("\n").sort()
	, [...ownedSubtypeHostedArchiveImplementationPaths].sort());
});

test("owned Subtype hosted-archive history rejects alterations", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeHostedArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(update.path
		, update.currentSha256, beforeOwnedSubtypeHostedArchiveSource);
	assert.throws(() => reverseOwnedSubtypeHostedArchiveUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.throws(() => reverseOwnedSubtypeHostedArchiveUpdate(current
		, { ...update, path: "unknown.mjs" }));
	assert.equal(beforeOwnedSubtypeHostedArchiveSource(
		update.path, `${current}unknown`), `${current}unknown`);
});

test("owned Subtype hosted-archive writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir()
		, "lean-owned-subtype-hosted-archive-guard-"));
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
		"scripts/update-owned-subtype-hosted-archive-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
