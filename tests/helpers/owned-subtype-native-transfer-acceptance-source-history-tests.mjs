/**
 * Authenticate the native owned-Subtype transfer acceptance correction.
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
	beforeOwnedSubtypeNativeTransferAcceptanceSource
	, ownedSubtypeNativeTransferAcceptanceChangedPaths
	, ownedSubtypeNativeTransferAcceptanceHistoryPath
	, ownedSubtypeNativeTransferAcceptanceImplementation
	, ownedSubtypeNativeTransferAcceptanceIntegrationPaths
	, ownedSubtypeNativeTransferAcceptancePredecessor
	, reverseOwnedSubtypeNativeTransferAcceptanceUpdate
} from "./owned-subtype-native-transfer-acceptance-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("native owned-Subtype transfer acceptance restores every source", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeNativeTransferAcceptanceHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "owned-subtype-native-transfer-acceptance-source-v1");
	assert.equal(record.predecessorCommit
		, ownedSubtypeNativeTransferAcceptancePredecessor);
	assert.equal(record.implementationCommit
		, ownedSubtypeNativeTransferAcceptanceImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, ownedSubtypeNativeTransferAcceptanceChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, ownedSubtypeNativeTransferAcceptanceIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedSubtypeNativeTransferAcceptanceSource);
		assert.equal(reverseOwnedSubtypeNativeTransferAcceptanceUpdate(current, update)
			, sourceAt(ownedSubtypeNativeTransferAcceptancePredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(ownedSubtypeNativeTransferAcceptancePredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeOwnedSubtypeNativeTransferAcceptanceSource);
		assert.equal(reverseOwnedSubtypeNativeTransferAcceptanceUpdate(current, update)
			, sourceAt(record.implementationCommit, update.path));
	}
});

test("native owned-Subtype transfer acceptance rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		ownedSubtypeNativeTransferAcceptanceHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeOwnedSubtypeNativeTransferAcceptanceSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseOwnedSubtypeNativeTransferAcceptanceUpdate(
		current, update));
});

test("native owned-Subtype transfer history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-owned-native-transfer-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-owned-subtype-native-transfer-acceptance-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
