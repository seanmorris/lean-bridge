/**
 * Bind the nested checked-record diagnostic-oracle correction to exact source
 * bytes while proving that package inventory and test registration stay put.
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
	beforeNestedCheckedRecordDiagnosticOracleSource
	, nestedCheckedRecordDiagnosticOracleAddedPaths
	, nestedCheckedRecordDiagnosticOracleChangedPaths
	, nestedCheckedRecordDiagnosticOracleHistoryPath
	, nestedCheckedRecordDiagnosticOraclePredecessor
	, nestedCheckedRecordDiagnosticOracleUnchangedPaths
	, nestedCheckedRecordNativeArchiveHistoricalCommit
	, nestedCheckedRecordNativeArchiveHistoricalParent
	, nestedCheckedRecordNativeArchiveHistoricalPaths
	, beforeNestedCheckedRecordNativeArchiveHistoricalSource
	, reverseNestedCheckedRecordDiagnosticOracleUpdate
	, reverseNestedCheckedRecordNativeArchiveHistoricalUpdate
} from "./nested-checked-record-diagnostic-oracle-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

test("nested checked-record diagnostic oracle has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordDiagnosticOracleHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "nested-checked-record-diagnostic-oracle-source-v1");
	assert.equal(record.predecessorCommit
		, nestedCheckedRecordDiagnosticOraclePredecessor);
	assert.equal(record.historicalCommit
		, nestedCheckedRecordNativeArchiveHistoricalCommit);
	assert.equal(record.historicalParent
		, nestedCheckedRecordNativeArchiveHistoricalParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, nestedCheckedRecordDiagnosticOracleChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, nestedCheckedRecordDiagnosticOracleAddedPaths);
	assert.deepEqual(record.unchanged.map(item => item.path)
		, nestedCheckedRecordDiagnosticOracleUnchangedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		nestedCheckedRecordDiagnosticOracleChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeNestedCheckedRecordDiagnosticOracleSource
		);
		const previous = git(["show"
			, `${nestedCheckedRecordDiagnosticOraclePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseNestedCheckedRecordDiagnosticOracleUpdate(
			current, update), previous, update.path);
		assert.equal(beforeNestedCheckedRecordDiagnosticOracleSource(
			update.path, current), previous, update.path);
		assert.equal(beforeNestedCheckedRecordDiagnosticOracleSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
		const unknown = current + "unknown";
		assert.equal(beforeNestedCheckedRecordDiagnosticOracleSource(
			update.path, unknown), unknown, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
			, item => { item.edits[0].start = -1; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNestedCheckedRecordDiagnosticOracleUpdate(
				current, changed));
		}
	}
});

test("diagnostic-oracle history repairs the omitted native archive transition", async () => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordDiagnosticOracleHistoryPath, "utf8"));
	assert.deepEqual(record.historicalUpdates.map(update => update.path)
		, nestedCheckedRecordNativeArchiveHistoricalPaths);
	for(const update of record.historicalUpdates)
	{
		const current = git(["show"
			, `${nestedCheckedRecordNativeArchiveHistoricalCommit}:${update.path}`]);
		const previous = git(["show"
			, `${nestedCheckedRecordNativeArchiveHistoricalParent}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseNestedCheckedRecordNativeArchiveHistoricalUpdate(
			current, update), previous, update.path);
		assert.equal(beforeNestedCheckedRecordNativeArchiveHistoricalSource(
			update.path, current, update.previousSha256), previous, update.path);
		const live = await readFile(update.path, "utf8");
		assert.equal(beforeFinRefinementSource(
			update.path, live, update.previousSha256), previous, update.path);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() => reverseNestedCheckedRecordNativeArchiveHistoricalUpdate(
				current, changed));
		}
	}
});

test("diagnostic-oracle additions and unchanged boundaries are closed", async () => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordDiagnosticOracleHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeNestedCheckedRecordDiagnosticOracleSource
		);
		assert.equal(sha256(current)
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${nestedCheckedRecordDiagnosticOraclePredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	assert.equal(record.pinCount, 0);
	for(const boundary of record.unchanged)
	{
		const current = await sourceAtFinHistoryMilestone(
			boundary.path, boundary.sha256
			, beforeNestedCheckedRecordDiagnosticOracleSource
		);
		const previous = git(["show"
			, `${nestedCheckedRecordDiagnosticOraclePredecessor}:${boundary.path}`]);
		assert.equal(current, previous, boundary.path);
		assert.equal(sha256(current), boundary.sha256, boundary.path);
	}
	const inventoryBoundary = record.unchanged.find(
		item => item.path === "docs/type-surface.v1.json"
	);
	const inventory = JSON.parse(await sourceAtFinHistoryMilestone(
		inventoryBoundary.path, inventoryBoundary.sha256
		, beforeNestedCheckedRecordDiagnosticOracleSource
	));
	assert.deepEqual(inventory.evidence.flatMap(entry => entry.files)
		.filter(file => nestedCheckedRecordDiagnosticOracleChangedPaths.includes(
			file.path)), []);
});

test("diagnostic-oracle history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-nested-checked-record-diagnostic-oracle-guard-"
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
		"scripts/update-nested-checked-record-diagnostic-oracle-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
