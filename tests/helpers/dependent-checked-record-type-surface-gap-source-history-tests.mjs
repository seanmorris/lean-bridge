/**
 * Authenticate the dependent checked-record type-surface history bridge.
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
	beforeDependentCheckedRecordTypeSurfaceGapSource
	, dependentCheckedRecordTypeSurfaceGapAddedPaths
	, dependentCheckedRecordTypeSurfaceGapHistoricalPaths
	, dependentCheckedRecordTypeSurfaceGapHistoryPath
	, dependentCheckedRecordTypeSurfaceGapIntegrationPaths
	, dependentCheckedRecordTypeSurfaceGapPredecessor
	, reverseDependentCheckedRecordTypeSurfaceGapHistorical
	, reverseDependentCheckedRecordTypeSurfaceGapIntegration
} from "./dependent-checked-record-type-surface-gap-source-history.mjs";

const path = "docs/type-surface.v1.json";
const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent checked-record type-surface gap restores exact Git states", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordTypeSurfaceGapHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-type-surface-gap-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordTypeSurfaceGapPredecessor);
	assert.deepEqual(record.historicalPaths
		, dependentCheckedRecordTypeSurfaceGapHistoricalPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordTypeSurfaceGapIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, dependentCheckedRecordTypeSurfaceGapAddedPaths);
	assert.equal(record.historicalTransitions.length, 14);
	for(const transition of record.historicalTransitions)
	{
		const previous = git(["show"
			, `${transition.previousCommit}:${transition.path}`]);
		const current = git(["show"
			, `${transition.currentCommit}:${transition.path}`]);
		assert.equal(sha256(previous), transition.previousSha256);
		assert.equal(sha256(current), transition.currentSha256);
		assert.equal(reverseDependentCheckedRecordTypeSurfaceGapHistorical(
			current, transition), previous);
	}
	for(let index = 0; index < record.historicalTransitions.length - 1; index++)
		assert.equal(record.historicalTransitions[index].previousSha256
			, record.historicalTransitions[index + 1].currentSha256);
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordTypeSurfaceGapSource);
		assert.equal(reverseDependentCheckedRecordTypeSurfaceGapIntegration(
			current, update), git(["show"
			, `${dependentCheckedRecordTypeSurfaceGapPredecessor}:${update.path}`]));
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	const latest = record.historicalTransitions[0];
	const earliest = record.historicalTransitions.at(-1);
	const source = git(["show", `${latest.currentCommit}:${path}`]);
	assert.equal(beforeDependentCheckedRecordTypeSurfaceGapSource(
		path, source, earliest.previousSha256)
		, git(["show", `${earliest.previousCommit}:${path}`]));
});

test("dependent checked-record type-surface gap refuses unknown bytes", async () => {
	const live = await readFile(path, "utf8");
	const unknown = `${live}\nunknown`;
	assert.equal(beforeDependentCheckedRecordTypeSurfaceGapSource(
		path, unknown), unknown);
});

test("dependent checked-record type-surface gap writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-dependent-checked-record-type-surface-gap-"));
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
		"scripts/update-dependent-checked-record-type-surface-gap-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
