/**
 * Authenticate the structured callable recovery gate repair.
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
	beforeStructuredCallableRecoveryGateRepairSource
	, reverseStructuredCallableRecoveryGateRepairUpdate
	, structuredCallableRecoveryGateRepairAddedPaths
	, structuredCallableRecoveryGateRepairChangedPaths
	, structuredCallableRecoveryGateRepairHistoryPath
	, structuredCallableRecoveryGateRepairImplementation
	, structuredCallableRecoveryGateRepairIntegrationPaths
	, structuredCallableRecoveryGateRepairPredecessor
} from "./structured-callable-recovery-gate-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("structured callable recovery gate history restores every source"
	, async () => {
		const record = JSON.parse(await readFile(
			structuredCallableRecoveryGateRepairHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "structured-callable-recovery-gate-repair-source-v1");
		assert.equal(record.predecessorCommit
			, structuredCallableRecoveryGateRepairPredecessor);
		assert.equal(record.implementationCommit
			, structuredCallableRecoveryGateRepairImplementation);
		assert.deepEqual(record.updates.map(item => item.path)
			, structuredCallableRecoveryGateRepairChangedPaths);
		assert.deepEqual(record.integrationUpdates.map(item => item.path)
			, structuredCallableRecoveryGateRepairIntegrationPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, structuredCallableRecoveryGateRepairAddedPaths);
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(update.path
				, update.currentSha256
				, beforeStructuredCallableRecoveryGateRepairSource);
			const previous = git(["show"
				, `${structuredCallableRecoveryGateRepairPredecessor}:${update.path}`]);
			assert.equal(reverseStructuredCallableRecoveryGateRepairUpdate(
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
				, beforeStructuredCallableRecoveryGateRepairSource);
			const previous = git(["show"
				, `${structuredCallableRecoveryGateRepairImplementation}:${update.path}`]);
			assert.equal(reverseStructuredCallableRecoveryGateRepairUpdate(
				current, update), previous, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
		}
		for(const addition of record.additions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("structured callable recovery gate repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${structuredCallableRecoveryGateRepairImplementation}^`]).trim()
	, structuredCallableRecoveryGateRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only"
		, structuredCallableRecoveryGateRepairPredecessor
		, structuredCallableRecoveryGateRepairImplementation])
		.trim().split("\n").filter(Boolean).sort()
	, [...structuredCallableRecoveryGateRepairChangedPaths].sort());
});

test("structured callable recovery gate history rejects alteration"
	, async () => {
		const record = JSON.parse(await readFile(
			structuredCallableRecoveryGateRepairHistoryPath, "utf8"));
		for(const original of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(original.path
				, original.currentSha256
				, beforeStructuredCallableRecoveryGateRepairSource);
			const update = structuredClone(original);
			update.currentSha256 = "0".repeat(64);
			assert.throws(() => reverseStructuredCallableRecoveryGateRepairUpdate(
				current, update), original.path);
		}
	}
);

test("structured callable recovery gate writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-structured-callable-recovery-history-"));
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
			"scripts/update-structured-callable-recovery-gate-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /exact implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
