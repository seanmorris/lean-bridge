/**
 * Authenticate the zero-payload .NET package source milestone.
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
	beforeZeroPayloadDotnetSource, reverseZeroPayloadDotnetUpdate
	, zeroPayloadDotnetChangedPaths, zeroPayloadDotnetHistoryPath
	, zeroPayloadDotnetImplementation, zeroPayloadDotnetIntegrationPaths
	, zeroPayloadDotnetPredecessor
} from "./zero-payload-dotnet-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

test("zero-payload .NET history restores every source", async () => {
	const record = JSON.parse(await readFile(zeroPayloadDotnetHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "zero-payload-dotnet-source-v1");
	assert.equal(record.predecessorCommit, zeroPayloadDotnetPredecessor);
	assert.equal(record.implementationCommit, zeroPayloadDotnetImplementation);
	assert.equal(record.reconciledTypeSurfacePointers, 0);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadDotnetChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadDotnetIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeZeroPayloadDotnetSource
		);
		assert.equal(reverseZeroPayloadDotnetUpdate(current, update)
			, sourceAt(zeroPayloadDotnetImplementation, update.path));
		assert.equal(beforeZeroPayloadDotnetSource(update.path, current)
			, sourceAt(zeroPayloadDotnetImplementation, update.path));
		assert.equal(beforeZeroPayloadDotnetSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256)
			, sourceAt(zeroPayloadDotnetImplementation, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256, beforeZeroPayloadDotnetSource
		);
		assert.equal(reverseZeroPayloadDotnetUpdate(current, update)
			, sourceAt(zeroPayloadDotnetImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("zero-payload .NET history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(zeroPayloadDotnetHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256, beforeZeroPayloadDotnetSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadDotnetUpdate(current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseZeroPayloadDotnetUpdate(current, update));
});

test("zero-payload .NET history writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-dotnet-history-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, {
		cwd: root, env, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-zero-payload-dotnet-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
