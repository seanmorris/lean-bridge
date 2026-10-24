/**
 * Authenticate the explicit Core milestone replay repair.
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
	beforeCoreMilestoneReplayRepairSource
	, coreMilestoneReplayRepairAddedPaths
	, coreMilestoneReplayRepairChangedPaths
	, coreMilestoneReplayRepairHistoryPath
	, coreMilestoneReplayRepairImplementation
	, coreMilestoneReplayRepairIntegrationBase
	, coreMilestoneReplayRepairIntegrationPaths
	, coreMilestoneReplayRepairPredecessor
	, reverseCoreMilestoneReplayRepairUpdate
} from "./core-milestone-replay-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("Core milestone replay repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		coreMilestoneReplayRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "core-milestone-replay-repair-source-v1");
	assert.equal(record.predecessorCommit
		, coreMilestoneReplayRepairPredecessor);
	assert.equal(record.implementationCommit
		, coreMilestoneReplayRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, coreMilestoneReplayRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreMilestoneReplayRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, coreMilestoneReplayRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreMilestoneReplayRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCoreMilestoneReplayRepairSource);
		const previous = git(["show"
			, `${coreMilestoneReplayRepairPredecessor}:${update.path}`]);
		assert.equal(reverseCoreMilestoneReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCoreMilestoneReplayRepairSource);
		const previous = git(["show"
			, `${coreMilestoneReplayRepairIntegrationBase}:${update.path}`]);
		assert.equal(reverseCoreMilestoneReplayRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
		, previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
		, addition.currentSha256, addition.path);
});

test("Core milestone replay repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${coreMilestoneReplayRepairImplementation}^`]).trim()
	, coreMilestoneReplayRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, coreMilestoneReplayRepairPredecessor
		, coreMilestoneReplayRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...coreMilestoneReplayRepairChangedPaths].sort());
});

test("Core milestone replay repair refreshes exactly 118 pins only", async () => {
	const record = JSON.parse(await readFile(
		coreMilestoneReplayRepairHistoryPath, "utf8"));
	const update = record.integrationUpdates.find(item =>
		item.path === "docs/type-surface.v1.json");
	assert.ok(update);
	const current = JSON.parse(await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256));
	const previous = JSON.parse(git(["show"
		, `${coreMilestoneReplayRepairIntegrationBase}:${update.path}`]));
	const expected = new Map([
		["scripts/generate-type-docs.mjs", 110]
		, ["tests/callback-subtype-promotion.test.mjs", 8]
	]);
	const counts = new Map([...expected.keys()].map(path => [path, 0]));
	assert.equal(current.evidence.length, previous.evidence.length);
	for(const [index, evidence] of current.evidence.entries())
	{
		const oldEvidence = previous.evidence[index];
		assert.equal(evidence.files.length, oldEvidence.files.length);
		for(const [position, file] of evidence.files.entries())
		{
			const old = oldEvidence.files[position];
			assert.equal(file.path, old.path);
			if(expected.has(file.path))
			{
				const source = record.updates.find(item => item.path === file.path);
				assert.ok(source);
				assert.equal(old.sha256, source.previousSha256, file.path);
				assert.equal(file.sha256, source.currentSha256, file.path);
				old.sha256 = file.sha256;
				counts.set(file.path, counts.get(file.path) + 1);
			}
			else
			{
				assert.ok(!coreMilestoneReplayRepairChangedPaths.includes(file.path)
					, `Unexpected source pin requires refresh: ${file.path}`);
				assert.equal(file.sha256, old.sha256, file.path);
			}
		}
	}
	assert.deepEqual(counts, expected);
	assert.deepEqual(current, previous
		, "No support claim or observation may change with this source-pin repair");
});

test("Core milestone replay repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		coreMilestoneReplayRepairHistoryPath, "utf8"));
	const original = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(original.path
		, original.currentSha256, beforeCoreMilestoneReplayRepairSource);
	const update = structuredClone(original);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCoreMilestoneReplayRepairUpdate(
		current, update));
});

test("Core milestone replay writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-core-milestone-replay-repair-history-"));
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
		"scripts/update-core-milestone-replay-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /exact integration base/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
