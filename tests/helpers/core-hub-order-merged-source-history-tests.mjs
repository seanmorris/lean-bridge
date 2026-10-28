/**
 * Authenticate the exact local Core hub-order repair join.
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
	beforeCoreHubOrderMergedSource, coreHubOrderMergedAddedPaths
	, coreHubOrderMergedHistoryPath, coreHubOrderMergedImplementation
	, coreHubOrderMergedPaths, coreHubOrderMergedPredecessor
	, reverseCoreHubOrderMergedUpdate
} from "./core-hub-order-merged-source-history.mjs";
import { coreHubOrderRepairHistoryPath } from "./core-hub-order-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const readRecord = async () => JSON.parse(await readFile(
	coreHubOrderMergedHistoryPath, "utf8"));

test("merged Core hub-order repair restores its exact local predecessor", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.predecessorCommit, coreHubOrderMergedPredecessor);
	assert.equal(record.implementationCommit, coreHubOrderMergedImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, coreHubOrderMergedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreHubOrderMergedAddedPaths);
	assert.deepEqual(record.upstreamHistory, {
		path: coreHubOrderRepairHistoryPath
		, sha256: sha256(await readFile(coreHubOrderRepairHistoryPath))
	});
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${coreHubOrderMergedImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${coreHubOrderMergedPredecessor}:${update.path}`]);
		assert.equal(reverseCoreHubOrderMergedUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCoreHubOrderMergedSource(update.path, current
			, update.previousSha256), previous, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
	const inventory = record.updates.find(item =>
		item.path === "docs/type-surface.v1.json");
	assert.equal(inventory.edits.length, 4);
});

test("merged Core hub-order repair rejects altered content", async () => {
	const update = (await readRecord()).updates[1];
	const current = git(["show"
		, `${coreHubOrderMergedImplementation}:${update.path}`]);
	assert.throws(() => reverseCoreHubOrderMergedUpdate(current
		, { ...update, currentSha256: "0".repeat(64) }));
	assert.equal(beforeCoreHubOrderMergedSource(update.path, `${current}x`)
		, `${current}x`);
});

test("merged Core hub-order writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-core-hub-order-merged-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-core-hub-order-merged-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.deepEqual(await readdir(root), [".git"]);
});
