/**
 * Preserve the Core partition repair and both value-index profile transitions.
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
	beforeValueIndexCoreLineageRepairSource
	, reverseValueIndexCoreLineageHistoricalUpdate
	, reverseValueIndexCoreLineageRepairUpdate
	, valueIndexCoreLineageRepairAddedPaths
	, valueIndexCoreLineageRepairChangedPaths
	, valueIndexCoreLineageRepairDraftParent
	, valueIndexCoreLineageRepairHistoricalPaths
	, valueIndexCoreLineageRepairHistoryPath
	, valueIndexCoreLineageRepairPredecessor
} from "./value-index-core-lineage-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const profilePath = "src/adoption/test-profiles.mjs";
const profileCommits = Object.freeze({
	foundation: "6cfd228a7ea5b0677cd5c9068203e67e5ee399d7"
	, browser: "c1f471569d1855d990bc5e6fb94454f7620e5bab"
	, native: "fc5d255a48e863bfee9624def578b82c851d0566"
});
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("value-index Core lineage repair is exact and reversible", async () => {
	const record = JSON.parse(await readFile(
		valueIndexCoreLineageRepairHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "value-index-core-lineage-repair-source-v1");
	assert.equal(record.predecessorCommit
		, valueIndexCoreLineageRepairPredecessor);
	assert.equal(record.draftParentCommit
		, valueIndexCoreLineageRepairDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, valueIndexCoreLineageRepairChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, valueIndexCoreLineageRepairAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		valueIndexCoreLineageRepairChangedPaths
	)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeValueIndexCoreLineageRepairSource
		);
		const previous = git(["show"
			, `${valueIndexCoreLineageRepairPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseValueIndexCoreLineageRepairUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeValueIndexCoreLineageRepairSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeValueIndexCoreLineageRepairSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		const unknown = current + "unknown";
		assert.equal(beforeValueIndexCoreLineageRepairSource(update.path, unknown)
			, unknown, update.path);
	}
	const sample = record.updates.find(update =>
		update.path === "tests/checked-records.test.mjs"
	);
	const current = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeValueIndexCoreLineageRepairSource
	);
	for(const mutate of [
		item => { item.path = "unknown"; }
		, item => { item.previousSha256 = "0".repeat(64); }
		, item => { item.currentSha256 = "0".repeat(64); }
		, item => { item.edits = []; }
		, item => { item.edits[0].start = -1; }
		, item => { item.edits[0].current += "unknown"; }
	]) {
		const changed = structuredClone(sample); mutate(changed);
		assert.throws(() => reverseValueIndexCoreLineageRepairUpdate(
			current, changed));
	}
});

test("value-index test-profile history closes both omitted transitions", async () => {
	const record = JSON.parse(await readFile(
		valueIndexCoreLineageRepairHistoryPath, "utf8"
	));
	assert.deepEqual(valueIndexCoreLineageRepairHistoricalPaths, [profilePath]);
	assert.deepEqual(record.historicalTransitions.map(item => ({
		path: item.path, previousCommit: item.previousCommit
		, currentCommit: item.currentCommit
	})), [
		{ path: profilePath, previousCommit: profileCommits.browser
			, currentCommit: profileCommits.native }
		, { path: profilePath, previousCommit: profileCommits.foundation
			, currentCommit: profileCommits.browser }
	]);
	for(const transition of record.historicalTransitions)
	{
		const previous = git(["show"
			, `${transition.previousCommit}:${profilePath}`]);
		const current = git(["show"
			, `${transition.currentCommit}:${profilePath}`]);
		assert.equal(sha256(previous), transition.previousSha256);
		assert.equal(sha256(current), transition.currentSha256);
		assert.equal(reverseValueIndexCoreLineageHistoricalUpdate(
			current, transition), previous);
	}
	const foundation = git(["show", `${profileCommits.foundation}:${profilePath}`]);
	const browser = git(["show", `${profileCommits.browser}:${profilePath}`]);
	const native = git(["show", `${profileCommits.native}:${profilePath}`]);
	assert.equal(beforeValueIndexCoreLineageRepairSource(
		profilePath, native, sha256(browser)), browser);
	assert.equal(beforeValueIndexCoreLineageRepairSource(
		profilePath, native, sha256(foundation)), foundation);
	assert.equal(beforeValueIndexCoreLineageRepairSource(profilePath, native)
		, foundation);
	assert.equal(beforeValueIndexCoreLineageRepairSource(
		profilePath, native, sha256(native)), native);
	assert.equal(beforeValueIndexCoreLineageRepairSource(
		profilePath, native + "unknown"), native + "unknown");
	const changed = structuredClone(record.historicalTransitions[0]);
	changed.edits[0].current += "unknown";
	assert.throws(() => reverseValueIndexCoreLineageHistoricalUpdate(
		native, changed));
	assert.ok(finRefinementNormalizationPaths.includes(profilePath));
});

test("value-index Core lineage repair closes additions and live pins", async () => {
	const record = JSON.parse(await readFile(
		valueIndexCoreLineageRepairHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${valueIndexCoreLineageRepairPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
	assert.equal(record.pinCount, 3);
	const inventoryPath = "docs/type-surface.v1.json";
	const previousSource = git(["show"
		, `${valueIndexCoreLineageRepairPredecessor}:${inventoryPath}`]);
	const expected = JSON.parse(previousSource);
	let count = 0;
	for(const pin of record.pinUpdates)
	{
		const previous = git(["show"
			, `${valueIndexCoreLineageRepairPredecessor}:${pin.path}`]);
		const update = record.updates.find(item => item.path === pin.path);
		assert.ok(update, pin.path);
		assert.equal(sha256(previous), pin.previousSha256, pin.path);
		assert.equal(update.previousSha256, pin.previousSha256, pin.path);
		assert.equal(update.currentSha256, pin.currentSha256, pin.path);
		let found = 0;
		for(const evidence of expected.evidence) for(const file of evidence.files)
			if(file.path === pin.path && file.sha256 === pin.previousSha256)
			{
				file.sha256 = pin.currentSha256;
				found++;
			}
		assert.equal(found, pin.count, pin.path); count += found;
	}
	assert.equal(count, record.pinCount);
	assert.equal(await readFile(inventoryPath, "utf8")
		, JSON.stringify(expected, null, 2) + "\n");
});

test("value-index Core lineage writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-core-lineage-history-guard-"
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
		"scripts/update-value-index-core-lineage-repair-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact foundation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
