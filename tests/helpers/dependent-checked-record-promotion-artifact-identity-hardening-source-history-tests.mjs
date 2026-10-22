/**
 * Authenticate the dependent checked-record promotion artifact-identity
 * hardening.
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
	beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource
	, dependentCheckedRecordPromotionArtifactIdentityHardeningChangedPaths
	, dependentCheckedRecordPromotionArtifactIdentityHardeningHistoryPath
	, dependentCheckedRecordPromotionArtifactIdentityHardeningImplementation
	, dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationBase
	, dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationPaths
	, dependentCheckedRecordPromotionArtifactIdentityHardeningPredecessor
	, reverseDependentCheckedRecordPromotionArtifactIdentityHardeningIntegration
	, reverseDependentCheckedRecordPromotionArtifactIdentityHardeningUpdate
} from "./dependent-checked-record-promotion-artifact-identity-hardening-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent promotion artifact identity hardening restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPromotionArtifactIdentityHardeningHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-promotion-artifact-identity-hardening-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPromotionArtifactIdentityHardeningPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPromotionArtifactIdentityHardeningImplementation);
	assert.equal(record.integrationBaseCommit
		, dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationBase);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentCheckedRecordPromotionArtifactIdentityHardeningChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource);
		assert.equal(
			reverseDependentCheckedRecordPromotionArtifactIdentityHardeningUpdate(
				current, update)
			, sourceAt(dependentCheckedRecordPromotionArtifactIdentityHardeningPredecessor
				, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			dependentCheckedRecordPromotionArtifactIdentityHardeningPredecessor
			, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource);
		assert.equal(
			reverseDependentCheckedRecordPromotionArtifactIdentityHardeningIntegration(
				current, update)
			, sourceAt(
				dependentCheckedRecordPromotionArtifactIdentityHardeningIntegrationBase
				, update.path));
	}
});

test("dependent promotion artifact identity hardening rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPromotionArtifactIdentityHardeningHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPromotionArtifactIdentityHardeningSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() =>
		reverseDependentCheckedRecordPromotionArtifactIdentityHardeningUpdate(
			current, update));
});

test("dependent promotion artifact identity writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-promotion-artifact-identity-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-promotion-artifact-identity-hardening-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /integration base commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
