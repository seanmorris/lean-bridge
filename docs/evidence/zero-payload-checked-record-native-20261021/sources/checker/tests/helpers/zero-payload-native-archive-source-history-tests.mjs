/**
 * Authenticate the zero-payload native archive/backend source milestone.
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
	beforeZeroPayloadNativeArchiveSource
	, reverseZeroPayloadNativeArchiveUpdate
	, zeroPayloadNativeArchiveChangedPaths, zeroPayloadNativeArchiveHistoryPath
	, zeroPayloadNativeArchiveImplementation
	, zeroPayloadNativeArchiveIntegrationPaths
	, zeroPayloadNativeArchivePredecessor
} from "./zero-payload-native-archive-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("zero-payload native archive history restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadNativeArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-native-archive-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadNativeArchivePredecessor);
	assert.equal(record.implementationCommit, zeroPayloadNativeArchiveImplementation);
	assert.equal(record.reconciledTypeSurfacePointers, 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadNativeArchiveChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadNativeArchiveIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadNativeArchiveSource
		);
		assert.equal(reverseZeroPayloadNativeArchiveUpdate(current, update)
			, sourceAt(zeroPayloadNativeArchivePredecessor, update.path));
		assert.equal(beforeZeroPayloadNativeArchiveSource(update.path, current)
			, sourceAt(zeroPayloadNativeArchivePredecessor, update.path));
		assert.equal(beforeZeroPayloadNativeArchiveSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadNativeArchivePredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadNativeArchiveSource
		);
		assert.equal(reverseZeroPayloadNativeArchiveUpdate(current, update)
			, sourceAt(zeroPayloadNativeArchiveImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("zero-payload native archive history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadNativeArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeZeroPayloadNativeArchiveSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadNativeArchiveUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadNativeArchiveUpdate(current, update));
});

test("zero-payload native archive writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-native-archive-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-native-archive-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
