/**
 * Bind the recursive component compatibility repair to exact source bytes,
 * refreshed inventory pins and closed test registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { classifyRepositoryTest } from "../src/adoption/test-profiles.mjs";
import { beforeFinRefinementSource } from "./helpers/fin-refinement-source-history.mjs";
import {
	beforeRecursiveComponentRegressionRepairSource
	, recursiveComponentRegressionRepairAddedPaths
	, recursiveComponentRegressionRepairChangedPaths
	, recursiveComponentRegressionRepairHistoryPath
	, recursiveComponentRegressionRepairPredecessor
	, reverseRecursiveComponentRegressionRepairUpdate
} from "./helpers/recursive-component-regression-repair-source-history.mjs";
import { sha256 } from "./helpers/source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./helpers/source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("recursive component regression repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		recursiveComponentRegressionRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "recursive-component-regression-repair-source-v1");
	assert.equal(record.predecessorCommit
		, recursiveComponentRegressionRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, recursiveComponentRegressionRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, recursiveComponentRegressionRepairAddedPaths);
	assert.equal(record.pathsSha256
		, sha256(JSON.stringify(recursiveComponentRegressionRepairChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeRecursiveComponentRegressionRepairSource
		);
		const previous = git(["show"
			, `${recursiveComponentRegressionRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseRecursiveComponentRegressionRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeRecursiveComponentRegressionRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeRecursiveComponentRegressionRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeRecursiveComponentRegressionRepairSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => {
				if(item.edits) item.edits[0].current += "unknown";
				else item.replacements[0].current = "0".repeat(64);
			}
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseRecursiveComponentRegressionRepairUpdate(
				current, changed));
		}
	}
});

test("regression repair additions and test registration are closed", async () => {
	const record = JSON.parse(await readFile(
		recursiveComponentRegressionRepairHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeRecursiveComponentRegressionRepairSource
		);
		assert.equal(sha256(current)
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${recursiveComponentRegressionRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	const path
		= "tests/recursive-component-regression-repair-source-history.test.mjs";
	assert.equal(classifyRepositoryTest(path), "contract");
});

test("regression repair refreshes only matching live source pins", async () => {
	const record = JSON.parse(await readFile(
		recursiveComponentRegressionRepairHistoryPath, "utf8"));
	assert.equal(record.pinCount, record.pinUpdates.reduce(
		(count, pin) => count + pin.count, 0));
	assert.ok(record.pinCount > 0);
	const inventoryUpdate = record.updates.find(
		update => update.path === "docs/type-surface.v1.json"
	);
	const inventory = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryUpdate.path, inventoryUpdate.currentSha256
		, beforeRecursiveComponentRegressionRepairSource
	));
	for(const update of record.pinUpdates)
	{
		const files = inventory.evidence.flatMap(entry => entry.files)
			.filter(file => file.path === update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.currentSha256).length, update.count, update.path);
		assert.equal(files.filter(file => file.sha256
			=== update.previousSha256).length, 0, update.path);
	}
});

test("regression repair history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-recursive-component-regression-guard-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c"
		, "user.email=test@example.invalid", "-c", "commit.gpgsign=false"
		, "commit", "--allow-empty", "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-recursive-component-regression-repair-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
