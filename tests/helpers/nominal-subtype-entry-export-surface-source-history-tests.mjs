/**
 * Authenticate the nominal Subtype entry export-surface repair.
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
	beforeNominalSubtypeEntryExportSurfaceSource
	, nominalSubtypeEntryExportSurfaceAddedPaths
	, nominalSubtypeEntryExportSurfaceChangedPaths
	, nominalSubtypeEntryExportSurfaceHistoryPath
	, nominalSubtypeEntryExportSurfaceImplementation
	, nominalSubtypeEntryExportSurfaceIntegrationPaths
	, nominalSubtypeEntryExportSurfacePredecessor
	, reverseNominalSubtypeEntryExportSurfaceUpdate
} from "./nominal-subtype-entry-export-surface-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("nominal entry export-surface history restores every source", async () => {
	const record = JSON.parse(await readFile(
		nominalSubtypeEntryExportSurfaceHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "nominal-subtype-entry-export-surface-source-v1");
	assert.equal(record.predecessorCommit
		, nominalSubtypeEntryExportSurfacePredecessor);
	assert.equal(record.implementationCommit
		, nominalSubtypeEntryExportSurfaceImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, nominalSubtypeEntryExportSurfaceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, nominalSubtypeEntryExportSurfaceIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, nominalSubtypeEntryExportSurfaceAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeNominalSubtypeEntryExportSurfaceSource);
		const previous = git(["show"
			, `${nominalSubtypeEntryExportSurfacePredecessor}:${update.path}`]);
		assert.equal(reverseNominalSubtypeEntryExportSurfaceUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256
			, beforeNominalSubtypeEntryExportSurfaceSource);
		const previous = git(["show"
			, `${nominalSubtypeEntryExportSurfaceImplementation}:${update.path}`]);
		assert.equal(reverseNominalSubtypeEntryExportSurfaceUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("nominal entry export-surface repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${nominalSubtypeEntryExportSurfaceImplementation}^`]).trim()
	, nominalSubtypeEntryExportSurfacePredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, nominalSubtypeEntryExportSurfacePredecessor
		, nominalSubtypeEntryExportSurfaceImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...nominalSubtypeEntryExportSurfaceChangedPaths].sort());
});

test("nominal entry export-surface history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		nominalSubtypeEntryExportSurfaceHistoryPath, "utf8"));
	for(const original of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(original.path
			, original.currentSha256
			, beforeNominalSubtypeEntryExportSurfaceSource);
		const update = structuredClone(original);
		update.currentSha256 = "0".repeat(64);
		assert.throws(() => reverseNominalSubtypeEntryExportSurfaceUpdate(
			current, update), original.path);
	}
});

test("nominal entry export-surface writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-nominal-entry-export-surface-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const run = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	run(["init", "--quiet"]);
	run(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nominal-subtype-entry-export-surface-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
