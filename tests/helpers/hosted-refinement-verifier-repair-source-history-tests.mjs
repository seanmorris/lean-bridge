/**
 * Authenticate the hosted refinement validator and native-PHP verifier repair.
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
import {
	beforeHostedRefinementVerifierRepairSource
	, hostedRefinementVerifierRepairChangedPaths
	, hostedRefinementVerifierRepairHistoryPath
	, hostedRefinementVerifierRepairImplementation
	, hostedRefinementVerifierRepairIntegrationBase
	, hostedRefinementVerifierRepairIntegrationPaths
	, hostedRefinementVerifierRepairPredecessor
	, reverseHostedRefinementVerifierRepairUpdate
} from "./hosted-refinement-verifier-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("hosted refinement verifier repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		hostedRefinementVerifierRepairHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "hosted-refinement-verifier-repair-source-v1");
	assert.equal(record.predecessorCommit
		, hostedRefinementVerifierRepairPredecessor);
	assert.equal(record.implementationCommit
		, hostedRefinementVerifierRepairImplementation);
	assert.equal(record.integrationBaseCommit
		, hostedRefinementVerifierRepairIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, hostedRefinementVerifierRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, hostedRefinementVerifierRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeHostedRefinementVerifierRepairSource);
		assert.equal(reverseHostedRefinementVerifierRepairUpdate(
			current, update), sourceAt(
			hostedRefinementVerifierRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			hostedRefinementVerifierRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeHostedRefinementVerifierRepairSource);
		assert.equal(reverseHostedRefinementVerifierRepairUpdate(
			current, update), sourceAt(
			hostedRefinementVerifierRepairIntegrationBase, update.path));
	}
});

test("hosted refinement verifier repair history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		hostedRefinementVerifierRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeHostedRefinementVerifierRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseHostedRefinementVerifierRepairUpdate(
		current, update));
});

test("hosted refinement verifier repair writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-hosted-refinement-verifier-repair-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-hosted-refinement-verifier-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration base commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
