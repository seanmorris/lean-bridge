/**
 * Authenticate the clean-clone hosted acceptance handoff repairs.
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
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeHostedAcceptanceHandoffRepairSource
	, hostedAcceptanceHandoffRepairAdditions
	, hostedAcceptanceHandoffRepairChangedPaths
	, hostedAcceptanceHandoffRepairHistoryPath
	, hostedAcceptanceHandoffRepairImplementation
	, hostedAcceptanceHandoffRepairIntegrationPaths
	, hostedAcceptanceHandoffRepairPredecessor
	, reverseHostedAcceptanceHandoffRepairUpdate
} from "./hosted-acceptance-handoff-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("hosted acceptance handoff repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		hostedAcceptanceHandoffRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "hosted-acceptance-handoff-repair-source-v1");
	assert.equal(record.predecessorCommit
		, hostedAcceptanceHandoffRepairPredecessor);
	assert.equal(record.implementationCommit
		, hostedAcceptanceHandoffRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, hostedAcceptanceHandoffRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, hostedAcceptanceHandoffRepairIntegrationPaths);
	assert.deepEqual(record.additions.slice(0, hostedAcceptanceHandoffRepairAdditions.length)
		.map(item => item.path), hostedAcceptanceHandoffRepairAdditions);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeHostedAcceptanceHandoffRepairSource);
		assert.equal(reverseHostedAcceptanceHandoffRepairUpdate(current, update)
			, sourceAt(hostedAcceptanceHandoffRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(hostedAcceptanceHandoffRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeHostedAcceptanceHandoffRepairSource);
		assert.equal(reverseHostedAcceptanceHandoffRepairUpdate(current, update)
			, sourceAt(hostedAcceptanceHandoffRepairImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256
			, addition.path);
});

test("hosted acceptance handoff repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		hostedAcceptanceHandoffRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeHostedAcceptanceHandoffRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseHostedAcceptanceHandoffRepairUpdate(
		current, update));
});

test("hosted acceptance handoff repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-handoff-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-hosted-acceptance-handoff-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
