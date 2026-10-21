/**
 * Authenticate the dependent generic-Subtype CI evidence-pin reconciliation.
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
	beforeDependentGenericSubtypeCiPinReconciliationSource
	, dependentGenericSubtypeCiPinReconciliationChangedPaths
	, dependentGenericSubtypeCiPinReconciliationHistoryPath
	, dependentGenericSubtypeCiPinReconciliationImplementation
	, dependentGenericSubtypeCiPinReconciliationIntegrationPaths
	, dependentGenericSubtypeCiPinReconciliationPredecessor
	, reverseDependentGenericSubtypeCiPinReconciliationUpdate
} from "./dependent-generic-subtype-ci-pin-reconciliation-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent generic Subtype CI pin reconciliation restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentGenericSubtypeCiPinReconciliationHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-generic-subtype-ci-pin-reconciliation-source-v1");
	assert.equal(record.predecessorCommit
		, dependentGenericSubtypeCiPinReconciliationPredecessor);
	assert.equal(record.implementationCommit
		, dependentGenericSubtypeCiPinReconciliationImplementation);
	assert.equal(record.reconciledTypeSurfacePointers, 8);
	assert.deepEqual(record.updates.map(item => item.path)
		, dependentGenericSubtypeCiPinReconciliationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentGenericSubtypeCiPinReconciliationIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentGenericSubtypeCiPinReconciliationSource);
		const previous = sourceAt(
			dependentGenericSubtypeCiPinReconciliationPredecessor, update.path);
		assert.equal(reverseDependentGenericSubtypeCiPinReconciliationUpdate(
			current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentGenericSubtypeCiPinReconciliationSource);
		assert.equal(reverseDependentGenericSubtypeCiPinReconciliationUpdate(
			current, update), sourceAt(
			dependentGenericSubtypeCiPinReconciliationImplementation, update.path));
	}
});

test("dependent generic Subtype CI pin reconciliation rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentGenericSubtypeCiPinReconciliationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentGenericSubtypeCiPinReconciliationSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentGenericSubtypeCiPinReconciliationUpdate(
		current, update));
});

test("dependent generic Subtype CI pin writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-generic-subtype-ci-pin-"));
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
		"scripts/update-dependent-generic-subtype-ci-pin-reconciliation-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
