/**
 * Authenticate the value-index historical-inventory verifier repair.
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
	beforeValueIndexMatrixHistoricalInventoryRepairSource
	, reverseValueIndexMatrixHistoricalInventoryRepairUpdate
	, valueIndexMatrixHistoricalInventoryRepairAddedPaths
	, valueIndexMatrixHistoricalInventoryRepairHistoryPath
	, valueIndexMatrixHistoricalInventoryRepairImplementation
	, valueIndexMatrixHistoricalInventoryRepairIntegrationPaths
	, valueIndexMatrixHistoricalInventoryRepairModifiedPaths
	, valueIndexMatrixHistoricalInventoryRepairPredecessor
} from "./value-index-matrix-historical-inventory-repair-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

test("value-index historical-inventory repair restores every source"
	, async () => {
	const record = JSON.parse(await readFile(
		valueIndexMatrixHistoricalInventoryRepairHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "value-index-matrix-historical-inventory-repair-source-v1");
	assert.equal(record.predecessorCommit
		, valueIndexMatrixHistoricalInventoryRepairPredecessor);
	assert.equal(record.implementationCommit
		, valueIndexMatrixHistoricalInventoryRepairImplementation);
	assert.deepEqual(record.updates.map(item => item.path)
		, valueIndexMatrixHistoricalInventoryRepairModifiedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, valueIndexMatrixHistoricalInventoryRepairIntegrationPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, valueIndexMatrixHistoricalInventoryRepairAddedPaths);
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeValueIndexMatrixHistoricalInventoryRepairSource);
		const previous = git(["show"
			, `${valueIndexMatrixHistoricalInventoryRepairPredecessor}:${update.path}`]);
		assert.equal(reverseValueIndexMatrixHistoricalInventoryRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeValueIndexMatrixHistoricalInventoryRepairSource);
		const previous = git(["show"
			, `${valueIndexMatrixHistoricalInventoryRepairImplementation}:${update.path}`]);
		assert.equal(reverseValueIndexMatrixHistoricalInventoryRepairUpdate(
			current, update), previous, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path)
			, update.path);
	}
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
	}
);

test("value-index historical-inventory repair is one exact commit", () => {
	assert.equal(git(["rev-parse"
		, `${valueIndexMatrixHistoricalInventoryRepairImplementation}^`]).trim()
	, valueIndexMatrixHistoricalInventoryRepairPredecessor);
	assert.deepEqual(names(["diff", "--name-only"
		, valueIndexMatrixHistoricalInventoryRepairPredecessor
		, valueIndexMatrixHistoricalInventoryRepairImplementation])
	, [...valueIndexMatrixHistoricalInventoryRepairModifiedPaths].sort());
});

test("value-index historical-inventory repair rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		valueIndexMatrixHistoricalInventoryRepairHistoryPath, "utf8"));
	const update = structuredClone(record.updates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeValueIndexMatrixHistoricalInventoryRepairSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseValueIndexMatrixHistoricalInventoryRepairUpdate(
		current, update));
});

test("value-index historical-inventory writer refuses another checkout"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-value-index-history-inventory-repair-"));
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
		"scripts/update-value-index-matrix-historical-inventory-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
