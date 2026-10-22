/**
 * Authenticate the complete synchronous callback checked-record rollout.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackCheckedRecordPromotionSource
	, callbackCheckedRecordPromotionChangedPaths
	, callbackCheckedRecordPromotionCommits
	, callbackCheckedRecordPromotionHistoryPath
	, callbackCheckedRecordPromotionImplementation
	, callbackCheckedRecordPromotionIntegrationPaths
	, callbackCheckedRecordPromotionPredecessor
	, reverseCallbackCheckedRecordPromotionUpdate
} from "./callback-checked-record-promotion-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("callback checked-record promotion records every first-parent transition", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordPromotionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "callback-checked-record-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, callbackCheckedRecordPromotionPredecessor);
	assert.equal(record.implementationCommit
		, callbackCheckedRecordPromotionImplementation);
	assert.deepEqual(record.commits.map(item => item.commit)
		, callbackCheckedRecordPromotionCommits);
	assert.ok(record.reconciledTypeSurfacePointers > 0);
	for(const update of record.updates)
	{
		const current = git(["show", `${update.commit}:${update.path}`]);
		const previous = git(["show", `${update.parent}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(reverseCallbackCheckedRecordPromotionUpdate(
			current, update), previous, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		assert.equal(reverseCallbackCheckedRecordPromotionUpdate(current, update)
			, git(["show"
				, `${callbackCheckedRecordPromotionImplementation}:${update.path}`])
			, update.path);
	}
});

test("callback checked-record promotion normalizes live sources and additions", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordPromotionHistoryPath, "utf8"));
	for(const path of new Set([
		...callbackCheckedRecordPromotionChangedPaths
		, ...callbackCheckedRecordPromotionIntegrationPaths
	])) {
		const exists = spawnSync("git", ["cat-file", "-e"
			, `${callbackCheckedRecordPromotionPredecessor}:${path}`]);
		if(exists.status !== 0) continue;
		const current = await readFile(path, "utf8");
		const predecessor = git(["show"
			, `${callbackCheckedRecordPromotionPredecessor}:${path}`]);
		const expected = sha256(predecessor);
		assert.equal(beforeCallbackCheckedRecordPromotionSource(
			path, current, expected), predecessor, path);
		assert.equal(beforeFinRefinementSource(path, current, expected)
			, predecessor, path);
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
});

test("callback checked-record promotion rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		callbackCheckedRecordPromotionHistoryPath, "utf8"));
	const update = structuredClone(record.updates.at(-1));
	const current = git(["show", `${update.commit}:${update.path}`]);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseCallbackCheckedRecordPromotionUpdate(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseCallbackCheckedRecordPromotionUpdate(
		current, update));
});

test("callback checked-record promotion history writer refuses unrelated checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "callback-checked-record-promotion-history-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const unrelatedGit = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env, stdio: "pipe" });
	unrelatedGit(["init", "--quiet"]);
	unrelatedGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-checked-record-promotion-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
