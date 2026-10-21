/**
 * Authenticate the zero-payload .NET package-control diagnostic repair.
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
import { sha256 } from "./source-history-digest.mjs";
import {
	beforeZeroPayloadDotnetControlRepairSource
	, reverseZeroPayloadDotnetControlRepairUpdate
	, zeroPayloadDotnetControlRepairChangedPaths
	, zeroPayloadDotnetControlRepairHistoryPath
	, zeroPayloadDotnetControlRepairImplementation
	, zeroPayloadDotnetControlRepairIntegrationPaths
	, zeroPayloadDotnetControlRepairPredecessor
} from "./zero-payload-dotnet-control-repair-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("zero-payload .NET control repair restores every source", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadDotnetControlRepairHistoryPath, "utf8"
	));
	assert.equal(record.milestone, "zero-payload-dotnet-control-repair-v1");
	assert.equal(record.predecessorCommit
		, zeroPayloadDotnetControlRepairPredecessor);
	assert.equal(record.implementationCommit
		, zeroPayloadDotnetControlRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, zeroPayloadDotnetControlRepairChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, zeroPayloadDotnetControlRepairIntegrationPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadDotnetControlRepairSource
		);
		assert.equal(reverseZeroPayloadDotnetControlRepairUpdate(current, update)
			, sourceAt(zeroPayloadDotnetControlRepairPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256
		), sourceAt(zeroPayloadDotnetControlRepairPredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeZeroPayloadDotnetControlRepairSource
		);
		assert.equal(reverseZeroPayloadDotnetControlRepairUpdate(current, update)
			, sourceAt(zeroPayloadDotnetControlRepairImplementation, update.path));
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
});

test("zero-payload .NET control repair rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		zeroPayloadDotnetControlRepairHistoryPath, "utf8"
	));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeZeroPayloadDotnetControlRepairSource
	);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseZeroPayloadDotnetControlRepairUpdate(
		current, update
	));
});

test("zero-payload .NET control repair writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-zero-payload-dotnet-control-repair-"
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
		"scripts/update-zero-payload-dotnet-control-repair-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);}
);
