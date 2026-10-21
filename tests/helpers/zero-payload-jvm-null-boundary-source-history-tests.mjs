/**
 * Authenticate the zero-payload JVM public-carrier null-boundary repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeZeroPayloadJvmNullBoundarySource
	, reverseZeroPayloadJvmNullBoundaryUpdate
	, zeroPayloadJvmNullBoundaryChangedPaths
	, zeroPayloadJvmNullBoundaryHistoryPath
	, zeroPayloadJvmNullBoundaryHistoricalPaths
	, zeroPayloadJvmNullBoundaryImplementation
	, zeroPayloadJvmNullBoundaryIntegrationPaths
	, zeroPayloadJvmNullBoundaryPredecessor
} from "./zero-payload-jvm-null-boundary-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

test("zero-payload JVM null-boundary history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadJvmNullBoundaryHistoryPath, "utf8"));
	assert.equal(record.milestone, "zero-payload-jvm-null-boundary-source-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadJvmNullBoundaryPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadJvmNullBoundaryImplementation);
	assert.equal(record.reconciledTypeSurfacePointers, 68);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadJvmNullBoundaryChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadJvmNullBoundaryIntegrationPaths);
	assert.equal(record.historicalTransitions.length, 24);
	assert.deepEqual([...new Set(record.historicalTransitions.flatMap(
		item => item.updates.map(update => update.path)))].sort()
		, [...zeroPayloadJvmNullBoundaryHistoricalPaths].sort());
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadJvmNullBoundarySource);
		assert.equal(reverseZeroPayloadJvmNullBoundaryUpdate(current, update)
			, sourceAt(zeroPayloadJvmNullBoundaryPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadJvmNullBoundaryPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadJvmNullBoundarySource);
		assert.equal(reverseZeroPayloadJvmNullBoundaryUpdate(current, update)
			, sourceAt(zeroPayloadJvmNullBoundaryImplementation, update.path));
	}
	for(const transition of record.historicalTransitions)
		for(const update of transition.updates)
		{
			const current = sourceAt(transition.commit, update.path);
			assert.equal(reverseZeroPayloadJvmNullBoundaryUpdate(current, update)
				, sourceAt(transition.predecessorCommit, update.path));
		}
	const typeGaps = record.historicalTransitions.filter(item =>
		item.updates[0].path === "docs/type-surface.v1.json");
	const firstGap = typeGaps[0];
	const lastGap = typeGaps.at(-1);
	const lastUpdate = lastGap.updates[0];
	assert.equal(beforeFinRefinementSource(
		lastUpdate.path, sourceAt(firstGap.commit, firstGap.updates[0].path)
		, lastUpdate.previousSha256)
		, sourceAt(lastGap.predecessorCommit, lastUpdate.path));
	const profileGaps = record.historicalTransitions.filter(item =>
		item.updates[0].path === "src/adoption/test-profiles.mjs");
	const firstProfile = profileGaps[0];
	const lastProfile = profileGaps.at(-1);
	const lastProfileUpdate = lastProfile.updates[0];
	assert.equal(beforeFinRefinementSource(
		lastProfileUpdate.path, sourceAt(
			firstProfile.commit, firstProfile.updates[0].path)
		, lastProfileUpdate.previousSha256)
		, sourceAt(lastProfile.predecessorCommit, lastProfileUpdate.path));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256
			, addition.path);
});

test("zero-payload JVM null-boundary history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadJvmNullBoundaryHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeZeroPayloadJvmNullBoundarySource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadJvmNullBoundaryUpdate(current, update));
});

test("zero-payload JVM null-boundary writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-jvm-null-boundary-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-jvm-null-boundary-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
