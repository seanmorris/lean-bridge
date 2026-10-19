/**
 * Preserve every predecessor through installed JVM acceptance and the native
 * value-index diagnostic repair.
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
	beforeCheckedRecordValueIndexJvmNativeRepairSource
	, checkedRecordValueIndexJvmNativeRepairAddedPaths
	, checkedRecordValueIndexJvmNativeRepairChangedPaths
	, checkedRecordValueIndexJvmNativeRepairDraftParent
	, checkedRecordValueIndexJvmNativeRepairHistoryPath
	, checkedRecordValueIndexJvmNativeRepairPredecessor
	, reverseCheckedRecordValueIndexJvmNativeRepairUpdate
} from "./checked-record-value-index-jvm-native-repair-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("installed JVM and native diagnostic repair have one reversible lineage"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexJvmNativeRepairHistoryPath, "utf8"
		));
		assert.equal(record.schemaVersion, 1);
		assert.equal(record.milestone
			, "checked-record-value-index-jvm-native-repair-source-v1");
		assert.equal(record.predecessorCommit
			, checkedRecordValueIndexJvmNativeRepairPredecessor);
		assert.equal(record.draftParentCommit
			, checkedRecordValueIndexJvmNativeRepairDraftParent);
		assert.deepEqual(record.updates.map(update => update.path)
			, checkedRecordValueIndexJvmNativeRepairChangedPaths);
		assert.deepEqual(record.additions.map(item => item.path)
			, checkedRecordValueIndexJvmNativeRepairAddedPaths);
		assert.equal(record.pathsSha256, sha256(JSON.stringify(
			checkedRecordValueIndexJvmNativeRepairChangedPaths
		)));
		for(const update of record.updates)
		{
			const current = await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256
					, beforeCheckedRecordValueIndexJvmNativeRepairSource
			);
			const previous = git(["show"
				, `${checkedRecordValueIndexJvmNativeRepairPredecessor}:${update.path}`]);
			assert.equal(sha256(current), update.currentSha256, update.path);
			assert.equal(sha256(previous), update.previousSha256, update.path);
			assert.equal(reverseCheckedRecordValueIndexJvmNativeRepairUpdate(
				current, update), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexJvmNativeRepairSource(
				update.path, current), previous, update.path);
			assert.equal(beforeCheckedRecordValueIndexJvmNativeRepairSource(
				update.path, current, update.currentSha256), current, update.path);
			assert.ok(finRefinementNormalizationPaths.includes(update.path));
			const unknown = current + "unknown";
			assert.equal(beforeCheckedRecordValueIndexJvmNativeRepairSource(
				update.path, unknown), unknown, update.path);
		}
		const sample = record.updates.find(update =>
			update.path.endsWith("checked-record-value-index-native/c.c")
		);
		const current = await sourceAtFinHistoryMilestone(
			sample.path, sample.currentSha256
				, beforeCheckedRecordValueIndexJvmNativeRepairSource
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
			assert.throws(() => reverseCheckedRecordValueIndexJvmNativeRepairUpdate(
				current, changed));
		}
	}
);

test("installed JVM and native diagnostic repair close every addition"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexJvmNativeRepairHistoryPath, "utf8"
		));
		for(const addition of record.additions)
		{
			const current = await sourceAtFinHistoryMilestone(
				addition.path, addition.currentSha256
					, beforeCheckedRecordValueIndexJvmNativeRepairSource
			);
			assert.equal(sha256(current), addition.currentSha256, addition.path);
			assert.notEqual(spawnSync("git", ["cat-file", "-e"
				, `${checkedRecordValueIndexJvmNativeRepairPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		}
	}
);

test("installed JVM and native diagnostic repair refresh exact milestone pins"
	, async () => {
		const record = JSON.parse(await readFile(
			checkedRecordValueIndexJvmNativeRepairHistoryPath, "utf8"
		));
		assert.equal(record.pinCount, 3);
		const inventoryPath = "docs/type-surface.v1.json";
		const inventoryUpdate = record.updates.find(update =>
			update.path === inventoryPath
		);
		assert.ok(inventoryUpdate);
		const previousSource = git(["show"
			, `${checkedRecordValueIndexJvmNativeRepairPredecessor}:${inventoryPath}`]);
		const expected = JSON.parse(previousSource);
		let count = 0;
		for(const pin of record.pinUpdates)
		{
			const previous = git(["show"
				, `${checkedRecordValueIndexJvmNativeRepairPredecessor}:${pin.path}`]);
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
				, beforeCheckedRecordValueIndexJvmNativeRepairSource
		);
		assert.equal(current, JSON.stringify(expected, null, 2) + "\n");
	}
);

test("installed JVM and native diagnostic history writer refuses another checkout"
	, async t => {
		const root = await mkdtemp(join(
			tmpdir(), "lean-bridge-value-index-jvm-native-history-guard-"
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
			"scripts/update-checked-record-value-index-jvm-native-repair-source-history.mjs"
		)], { cwd: root, env: environment, encoding: "utf8" });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /must stay on its exact implementation head/u);
		assert.deepEqual(await readdir(root), [".git"]);
	}
);
