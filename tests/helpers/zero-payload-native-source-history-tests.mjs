/**
 * Authenticate the zero-payload C/C++ package source milestone.
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
	beforeZeroPayloadNativeSource, reverseZeroPayloadNativeUpdate
	, zeroPayloadNativeChangedPaths, zeroPayloadNativeHistoryPath
	, zeroPayloadNativeImplementation, zeroPayloadNativeIntegrationPaths
	, zeroPayloadNativePredecessor
} from "./zero-payload-native-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("zero-payload native history restores every source", async () => {
	const record = JSON.parse(await readFile(zeroPayloadNativeHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-native-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadNativePredecessor);
	assert.equal(record.implementationCommit, zeroPayloadNativeImplementation);
	assert.equal(record.reconciledTypeSurfacePointers, 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadNativeChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadNativeIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeZeroPayloadNativeSource
		);
		assert.equal(reverseZeroPayloadNativeUpdate(current, update)
			, sourceAt(zeroPayloadNativePredecessor, update.path));
		assert.equal(beforeZeroPayloadNativeSource(update.path, current)
			, sourceAt(zeroPayloadNativePredecessor, update.path));
		assert.equal(beforeZeroPayloadNativeSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadNativePredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeZeroPayloadNativeSource
		);
		assert.equal(reverseZeroPayloadNativeUpdate(current, update)
			, sourceAt(zeroPayloadNativeImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("zero-payload native history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(zeroPayloadNativeHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeZeroPayloadNativeSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadNativeUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadNativeUpdate(current, update));
});

test("zero-payload native history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-zero-payload-native-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-native-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
