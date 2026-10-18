/**
 * Preserve every predecessor through the hosted value-index .NET repair.
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
	beforeCheckedRecordValueIndexDotnetHostedRepairSource
	, checkedRecordValueIndexDotnetHostedRepairAddedPaths
	, checkedRecordValueIndexDotnetHostedRepairChangedPaths
	, checkedRecordValueIndexDotnetHostedRepairDraftParent
	, checkedRecordValueIndexDotnetHostedRepairHistoryPath
	, checkedRecordValueIndexDotnetHostedRepairPredecessor
	, reverseCheckedRecordValueIndexDotnetHostedRepairUpdate
} from "./checked-record-value-index-dotnet-hosted-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("hosted value-index .NET repair has one exact reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexDotnetHostedRepairHistoryPath, "utf8"));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-dotnet-hosted-repair-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexDotnetHostedRepairPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexDotnetHostedRepairDraftParent);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexDotnetHostedRepairChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexDotnetHostedRepairAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexDotnetHostedRepairChangedPaths)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexDotnetHostedRepairSource);
			const previous = git(["show"
				, `${checkedRecordValueIndexDotnetHostedRepairPredecessor}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseCheckedRecordValueIndexDotnetHostedRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexDotnetHostedRepairSource(
				update.path, current), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexDotnetHostedRepairSource(
				update.path, current, update.currentSha256), current, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			const unknown = current + "unknown";
			assert.equal(beforeCheckedRecordValueIndexDotnetHostedRepairSource(
				update.path, unknown), unknown, update.path);
		}
		const sample = record.updates.find(update =>
			update.path.endsWith("checked-record-value-index-dotnet-report.mjs"));
		const current = await sourceAtFinHistoryMilestone(
			sample.path, sample.currentSha256
				, beforeCheckedRecordValueIndexDotnetHostedRepairSource);
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(sample); mutate(changed);
			assert.throws(() =>
				reverseCheckedRecordValueIndexDotnetHostedRepairUpdate(
					current, changed));
		}
	}
);

test("hosted value-index .NET repair closes every addition", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexDotnetHostedRepairHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		const current = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
				, beforeCheckedRecordValueIndexDotnetHostedRepairSource);
		assert.equal(sha256(current), addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexDotnetHostedRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("hosted value-index .NET repair refreshes exactly its milestone pins"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexDotnetHostedRepairHistoryPath, "utf8"));
		assert.equal(record.pinCount, 3);
		const inventoryPath = "docs/type-surface.v1.json";
		const inventoryUpdate = record.updates.find(update =>
			update.path === inventoryPath);
		assert.ok(inventoryUpdate);
		const previousSource = git(["show"
			, `${checkedRecordValueIndexDotnetHostedRepairPredecessor}:${inventoryPath}`]);
		const expected = JSON.parse(previousSource);
		let count = 0;
		for(const pin of record.pinUpdates)
		{
			const previous = git(["show"
				, `${checkedRecordValueIndexDotnetHostedRepairPredecessor}:${pin.path}`]);
			assert.equal(sha256(previous), pin.previousSha256, pin.path);
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
				, beforeCheckedRecordValueIndexDotnetHostedRepairSource);
		assert.equal(current, JSON.stringify(expected, null, 2) + "\n");
	}
);

test("hosted value-index .NET repair history writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-dotnet-repair-history-guard-"));
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
			"scripts/update-checked-record-value-index-dotnet-hosted-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact repair commit/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
