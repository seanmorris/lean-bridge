/**
 * Authenticate the zero-payload Python/Ruby type-surface history bridge.
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
	finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeZeroPayloadTypeSurfaceGapSource
	, reverseZeroPayloadTypeSurfaceGapHistorical
	, reverseZeroPayloadTypeSurfaceGapIntegration
	, zeroPayloadTypeSurfaceGapAddedPaths
	, zeroPayloadTypeSurfaceGapHistoricalPaths
	, zeroPayloadTypeSurfaceGapHistoryPath
	, zeroPayloadTypeSurfaceGapIntegrationPaths
	, zeroPayloadTypeSurfaceGapPredecessor
} from "./zero-payload-type-surface-gap-source-history.mjs";

const path = "docs/type-surface.v1.json";
const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

test("zero-payload type-surface gap restores exact Git states", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadTypeSurfaceGapHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-type-surface-gap-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadTypeSurfaceGapPredecessor);
	assert.deepEqual(record.historicalPaths
		, zeroPayloadTypeSurfaceGapHistoricalPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadTypeSurfaceGapIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, zeroPayloadTypeSurfaceGapAddedPaths);
	assert.equal(record.historicalTransitions.length, 2);
	for(const transition of record.historicalTransitions)
	{
		const previous = git(["show"
			, `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show"
			, `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256);
		assert.equal(sha256(current), transition.currentSha256);
		assert.equal(reverseZeroPayloadTypeSurfaceGapHistorical(
			current, transition), previous);
	}
	for(let index = 0; index < record.historicalTransitions.length - 1; index++)
		assert.equal(record.historicalTransitions[index].previousSha256
			, record.historicalTransitions[index + 1].currentSha256);
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadTypeSurfaceGapSource);
		assert.equal(reverseZeroPayloadTypeSurfaceGapIntegration(current, update)
			, git(["show", `${zeroPayloadTypeSurfaceGapPredecessor}:${update.path}`]));
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	const latest = record.historicalTransitions[0]
		, earliest = record.historicalTransitions.at(-1);
	const source = git(["show", `${latest.currentCommit}:${path}`]);
	assert.equal(beforeZeroPayloadTypeSurfaceGapSource(
		path, source, earliest.previousSha256)
	, git(["show", `${earliest.previousCommit}:${path}`]));
});

test("zero-payload type-surface gap refuses unknown bytes", async () => {
	const live = await readFile(path, "utf8");
	const unknown = `${live}\nunknown`;
	assert.equal(beforeZeroPayloadTypeSurfaceGapSource(path, unknown), unknown);
});

test("zero-payload type-surface gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-type-surface-gap-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-type-surface-gap-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
