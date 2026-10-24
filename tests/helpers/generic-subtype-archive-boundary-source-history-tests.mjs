/**
 * Authenticate the explicit Generic archive boundary repair.
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
	beforeGenericSubtypeArchiveBoundarySource
	, genericSubtypeArchiveBoundaryAddedPaths
	, genericSubtypeArchiveBoundaryImplementationPaths
	, genericSubtypeArchiveBoundaryChangedPaths
	, genericSubtypeArchiveBoundaryCommits
	, genericSubtypeArchiveBoundaryHistoryPath
	, genericSubtypeArchiveBoundaryImplementation
	, genericSubtypeArchiveBoundaryIntegrationBase
	, genericSubtypeArchiveBoundaryIntegrationPaths
	, genericSubtypeArchiveBoundaryPredecessor
	, reverseGenericSubtypeArchiveBoundaryUpdate
} from "./generic-subtype-archive-boundary-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Generic archive boundary repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		genericSubtypeArchiveBoundaryHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "generic-subtype-archive-boundary-source-v1");
	assert.equal(record.predecessorCommit
		, genericSubtypeArchiveBoundaryPredecessor);
	assert.equal(record.implementationCommit
		, genericSubtypeArchiveBoundaryImplementation);
	assert.deepEqual(record.implementationCommits, genericSubtypeArchiveBoundaryCommits);
	assert.equal(record.integrationBaseCommit
		, genericSubtypeArchiveBoundaryIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, genericSubtypeArchiveBoundaryChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, genericSubtypeArchiveBoundaryIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, genericSubtypeArchiveBoundaryAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeGenericSubtypeArchiveBoundarySource);
		const previous = git(["show"
			, `${genericSubtypeArchiveBoundaryPredecessor}:${update.path}`]);
		assert.equal(reverseGenericSubtypeArchiveBoundaryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeGenericSubtypeArchiveBoundarySource(update.path, current, update.currentSha256), current);
		assert.equal(beforeGenericSubtypeArchiveBoundarySource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeGenericSubtypeArchiveBoundarySource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeGenericSubtypeArchiveBoundarySource);
		const previous = git(["show"
			, `${genericSubtypeArchiveBoundaryIntegrationBase}:${update.path}`]);
		assert.equal(reverseGenericSubtypeArchiveBoundaryUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.equal(beforeGenericSubtypeArchiveBoundarySource(update.path, current, update.currentSha256), current);
		assert.equal(beforeGenericSubtypeArchiveBoundarySource(update.path, current, update.previousSha256), previous);
		assert.equal(beforeGenericSubtypeArchiveBoundarySource(update.path, current + "\nunknown"), current + "\nunknown");
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Generic archive boundary repair retains the exact implementation commit", () => {
	const predecessor = genericSubtypeArchiveBoundaryPredecessor;
	const implementation = genericSubtypeArchiveBoundaryImplementation;
	assert.deepEqual(git(["rev-list", "--reverse"
		, `${predecessor}..${implementation}`]).trim().split("\n")
	, genericSubtypeArchiveBoundaryCommits);
	for(const [index, revision] of genericSubtypeArchiveBoundaryCommits.entries())
		assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
			, index === 0 ? predecessor : genericSubtypeArchiveBoundaryCommits[index - 1]);
	assert.deepEqual(git(["diff", "--name-only"
		, genericSubtypeArchiveBoundaryPredecessor
		, genericSubtypeArchiveBoundaryImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...genericSubtypeArchiveBoundaryImplementationPaths].sort());
});

test("Generic archive boundary repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		genericSubtypeArchiveBoundaryHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeGenericSubtypeArchiveBoundarySource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseGenericSubtypeArchiveBoundaryUpdate(
		current, update));
});

test("Generic archive boundary writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-generic-subtype-archive-boundary-history-"));
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
		"scripts/update-generic-subtype-archive-boundary-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
