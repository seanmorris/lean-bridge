/**
 * Authenticate the callback-history evidence-pin reconciliation.
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
import {
	beforeCallbackSubtypeHistoryPinReconciliationSource
	, callbackSubtypeHistoryPinReconciliationChangedPaths
	, callbackSubtypeHistoryPinReconciliationHistoryPath
	, callbackSubtypeHistoryPinReconciliationImplementation
	, callbackSubtypeHistoryPinReconciliationIntegrationPaths
	, callbackSubtypeHistoryPinReconciliationPredecessor
	, reverseCallbackSubtypeHistoryPinReconciliationUpdate
} from "./callback-subtype-history-pin-reconciliation-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback-history pin reconciliation restores every source", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeHistoryPinReconciliationHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "callback-subtype-history-pin-reconciliation-source-v1");
	assert.equal(record.predecessorCommit
		, callbackSubtypeHistoryPinReconciliationPredecessor);
	assert.equal(record.implementationCommit
		, callbackSubtypeHistoryPinReconciliationImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, callbackSubtypeHistoryPinReconciliationChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, callbackSubtypeHistoryPinReconciliationIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackSubtypeHistoryPinReconciliationSource);
		assert.equal(reverseCallbackSubtypeHistoryPinReconciliationUpdate(
			current, update), sourceAt(
			callbackSubtypeHistoryPinReconciliationPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			callbackSubtypeHistoryPinReconciliationPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCallbackSubtypeHistoryPinReconciliationSource);
		assert.equal(reverseCallbackSubtypeHistoryPinReconciliationUpdate(
			current, update), sourceAt(
			callbackSubtypeHistoryPinReconciliationImplementation, update.path));
	}
});

test("callback-history pin reconciliation rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		callbackSubtypeHistoryPinReconciliationHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeCallbackSubtypeHistoryPinReconciliationSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackSubtypeHistoryPinReconciliationUpdate(
		current, update));
});

test("callback-history pin writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-callback-history-pin-"));
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
		"scripts/update-callback-subtype-history-pin-reconciliation-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
