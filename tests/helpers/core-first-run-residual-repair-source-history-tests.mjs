/**
 * Prove that the residual Core repair is exact, reversible and fail closed.
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
	beforeCoreFirstRunResidualRepairSource
	, coreFirstRunResidualRepairAddedPaths
	, coreFirstRunResidualRepairChangedPaths
	, coreFirstRunResidualRepairHistoryPath
	, coreFirstRunResidualRepairPredecessor
	, reverseCoreFirstRunResidualRepairUpdate
} from "./core-first-run-residual-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

test("Core first-run residual repair has one exact reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		coreFirstRunResidualRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "core-first-run-residual-repair-v1");
	assert.equal(record.predecessorCommit
		, coreFirstRunResidualRepairPredecessor);
	assert.deepEqual(record.updates.map(update => update.path)
		, coreFirstRunResidualRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, coreFirstRunResidualRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		coreFirstRunResidualRepairChangedPaths
	)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreFirstRunResidualRepairSource
		);
		const previous = git(["show"
			, `${coreFirstRunResidualRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCoreFirstRunResidualRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCoreFirstRunResidualRepairSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCoreFirstRunResidualRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeCoreFirstRunResidualRepairSource(
			update.path, unknown), unknown, update.path);
	}
});

test("Core first-run residual repair closes additions and every refreshed pin", async () => {
	const record = JSON.parse(await readFile(
		coreFirstRunResidualRepairHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${coreFirstRunResidualRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
	const previous = JSON.parse(git(["show"
		, `${coreFirstRunResidualRepairPredecessor}:docs/type-surface.v1.json`]));
	let count = 0;
	for(const pin of record.pinUpdates)
	{
		const update = record.updates.find(item => item.path === pin.path);
		assert.ok(update, pin.path);
		assert.equal(update.previousSha256, pin.previousSha256, pin.path);
		assert.equal(update.currentSha256, pin.currentSha256, pin.path);
		let found = 0;
		for(const evidence of previous.evidence) for(const file of evidence.files)
			if(file.path === pin.path)
			{
				assert.equal(file.sha256, pin.previousSha256, pin.path);
				file.sha256 = pin.currentSha256;
				found++;
			}
		assert.equal(found, pin.count, pin.path);
		count += found;
	}
	assert.equal(count, record.pinCount);
	const inventory = record.updates.find(update =>
		update.path === "docs/type-surface.v1.json"
	);
	assert.ok(inventory);
	const current = await sourceAtFinHistoryMilestone(
		inventory.path, inventory.currentSha256
		, beforeCoreFirstRunResidualRepairSource
	);
	assert.equal(current, JSON.stringify(previous, null, 2) + "\n");
});

test("Core first-run residual repair rejects forged transitions", async () => {
	const record = JSON.parse(await readFile(
		coreFirstRunResidualRepairHistoryPath, "utf8"
	));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCoreFirstRunResidualRepairSource
		);
		const mutations = [
			item => { item.path = "unknown.mjs"; }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		];
		for(const mutate of mutations)
		{
			const changed = structuredClone(update);
			mutate(changed);
			assert.throws(() => reverseCoreFirstRunResidualRepairUpdate(
				current, changed), update.path);
		}
	}
	const bytes = Buffer.from("bytes");
	assert.equal(beforeCoreFirstRunResidualRepairSource(
		"unknown.mjs", "source"), "source");
	assert.equal(beforeCoreFirstRunResidualRepairSource(
		coreFirstRunResidualRepairChangedPaths[0], bytes), bytes);
});

test("Core first-run residual repair writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-core-first-run-residual-repair-guard-"
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
		"scripts/update-core-first-run-residual-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact predecessor/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
