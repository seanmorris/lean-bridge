/**
 * Preserve every predecessor through the source-history assertion repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeSourceHistoryMilestoneAssertionRepairSource
	, reverseSourceHistoryMilestoneAssertionRepairUpdate
	, sourceHistoryMilestoneAssertionRepairAddedPaths
	, sourceHistoryMilestoneAssertionRepairChangedPaths
	, sourceHistoryMilestoneAssertionRepairDraftParent
	, sourceHistoryMilestoneAssertionRepairHistoryPath
	, sourceHistoryMilestoneAssertionRepairPredecessor
} from "./source-history-milestone-assertion-repair.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("source-history assertion repair has one exact reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			sourceHistoryMilestoneAssertionRepairHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "source-history-milestone-assertion-repair-v1");
		assert.equal(record.predecessorCommit
			, sourceHistoryMilestoneAssertionRepairPredecessor);
		assert.equal(record.draftParentCommit
			, sourceHistoryMilestoneAssertionRepairDraftParent);
		assert.deepEqual(record.updates.map(update => update.path)
			, sourceHistoryMilestoneAssertionRepairChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, sourceHistoryMilestoneAssertionRepairAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			sourceHistoryMilestoneAssertionRepairChangedPaths
		)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
				, beforeSourceHistoryMilestoneAssertionRepairSource
			);
			const previous = git(["show"
				, `${sourceHistoryMilestoneAssertionRepairPredecessor}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseSourceHistoryMilestoneAssertionRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeSourceHistoryMilestoneAssertionRepairSource(
				update.path, current), previous, update.path);
			assert.equal(beforeSourceHistoryMilestoneAssertionRepairSource(
				update.path, current, update.currentSha256), current, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			const unknown = current + "unknown";
			assert.equal(beforeSourceHistoryMilestoneAssertionRepairSource(
				update.path, unknown), unknown, update.path);
		}
		const sample = record.updates.find(update =>
			update.path.endsWith("core-quality-sharding-source-history-tests.mjs")
		);
		const current = await sourceAtFinHistoryMilestone(
			sample.path, sample.currentSha256
			, beforeSourceHistoryMilestoneAssertionRepairSource
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
			assert.throws(() => reverseSourceHistoryMilestoneAssertionRepairUpdate(
				current, changed));
		}
	}
);

test("source-history assertion repair closes every addition", async () => {
	const record = JSON.parse(await readFile(
		sourceHistoryMilestoneAssertionRepairHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
			, beforeSourceHistoryMilestoneAssertionRepairSource
		);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${sourceHistoryMilestoneAssertionRepairPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("source-history assertion repair refreshes exactly its milestone pins"
	, async () => {
		const record = JSON.parse(await readFile(
			sourceHistoryMilestoneAssertionRepairHistoryPath, "utf8"
		));
		assert.equal(record.pinCount, 3);
		const inventoryPath = "docs/type-surface.v1.json";
		const inventoryUpdate = record.updates.find(update =>
			update.path === inventoryPath
		);
		assert.ok(inventoryUpdate);
		const previousSource = git(["show"
			, `${sourceHistoryMilestoneAssertionRepairPredecessor}:${inventoryPath}`]);
		const expected = JSON.parse(previousSource);
		let count = 0;
		for(const pin of record.pinUpdates)
		{
			const previous = git(["show"
				, `${sourceHistoryMilestoneAssertionRepairPredecessor}:${pin.path}`]);
			const update = record.updates.find(item => item.path === pin.path);
			assert.ok(update, pin.path);
			assert.equal(sha256(previous), pin.previousSha256, pin.path);
			assert.equal(update.previousSha256, pin.previousSha256, pin.path);
			assert.equal(update.currentSha256, pin.currentSha256, pin.path);
			let found = 0;
			for(const evidence of expected.evidence)
				for(const file of evidence.files)
					if(file.path === pin.path
						&& file.sha256 === pin.previousSha256){
						file.sha256 = pin.currentSha256;
						found++;
						}
			assert.equal(found, pin.count, pin.path);
			count += found;
		}
		assert.equal(count, record.pinCount);
		const current = await sourceAtFinHistoryMilestone(
			inventoryPath, inventoryUpdate.currentSha256
			, beforeSourceHistoryMilestoneAssertionRepairSource
		);
		assert.equal(current, JSON.stringify(expected, null, 2) + "\n");
	}
);

test("source-history assertion writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-source-history-assertion-repair-guard-"
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
		"scripts/update-source-history-milestone-assertion-repair.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact repair commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
