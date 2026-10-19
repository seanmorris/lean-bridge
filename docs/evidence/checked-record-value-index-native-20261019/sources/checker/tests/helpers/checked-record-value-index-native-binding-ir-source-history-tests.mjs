/**
 * Preserve the exact native Binding IR verifier repair and all predecessor
 * bytes relied on by installed-evidence history tests.
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
	beforeCheckedRecordValueIndexNativeBindingIrSource
	, checkedRecordValueIndexNativeBindingIrAddedPaths
	, checkedRecordValueIndexNativeBindingIrChangedPaths
	, checkedRecordValueIndexNativeBindingIrDraftParent
	, checkedRecordValueIndexNativeBindingIrFoundationAddedPaths
	, checkedRecordValueIndexNativeBindingIrFoundationModifiedPaths
	, checkedRecordValueIndexNativeBindingIrHistoryPath
	, checkedRecordValueIndexNativeBindingIrPredecessor
	, reverseCheckedRecordValueIndexNativeBindingIrUpdate
} from "./checked-record-value-index-native-binding-ir-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});

test("native Binding IR report repair has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexNativeBindingIrHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-native-binding-ir-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexNativeBindingIrPredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexNativeBindingIrDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexNativeBindingIrChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexNativeBindingIrAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexNativeBindingIrChangedPaths
	)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexNativeBindingIrSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexNativeBindingIrPredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexNativeBindingIrUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexNativeBindingIrSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexNativeBindingIrSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCheckedRecordValueIndexNativeBindingIrSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	const sample = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeCheckedRecordValueIndexNativeBindingIrSource
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
		assert.throws(() => reverseCheckedRecordValueIndexNativeBindingIrUpdate(
			current, changed));
	}
});

test("native Binding IR report repair closes its exact committed tree", () => {
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexNativeBindingIrPredecessor
		, checkedRecordValueIndexNativeBindingIrDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(modified
		, [...checkedRecordValueIndexNativeBindingIrFoundationModifiedPaths].sort());
	const added = git(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexNativeBindingIrPredecessor
		, checkedRecordValueIndexNativeBindingIrDraftParent])
		.trim().split("\n").filter(Boolean).sort();
	assert.deepEqual(added
		, [...checkedRecordValueIndexNativeBindingIrFoundationAddedPaths].sort());
});

test("native Binding IR report repair closes every added source", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexNativeBindingIrHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await readFile(addition.path))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexNativeBindingIrPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
	}
});

test("native Binding IR history writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-native-binding-ir-guard-"
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
		"scripts/update-checked-record-value-index-native-binding-ir-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact repair commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
