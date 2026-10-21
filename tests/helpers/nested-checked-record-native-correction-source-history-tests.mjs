/**
 * Authenticate the nested checked-record native corrections and their source-pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256 } from "../../src/capsule/node.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import {
	beforeNestedCheckedRecordNativeCorrectionPins
	, beforeNestedCheckedRecordNativeCorrectionSource
	, nestedCheckedRecordNativeCorrectionChangedPaths
	, nestedCheckedRecordNativeCorrectionDraftParent
	, nestedCheckedRecordNativeCorrectionHistoryPath
	, nestedCheckedRecordNativeCorrectionNativePaths
	, nestedCheckedRecordNativeCorrectionSourcePredecessor
	, reverseNestedCheckedRecordNativeCorrectionUpdate
} from "./nested-checked-record-native-correction-source-history.mjs";

test("nested native correction history reconstructs every exact source predecessor", async t => {
	const record = JSON.parse(await readFile(
		nestedCheckedRecordNativeCorrectionHistoryPath, "utf8"
	));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone,
		"nested-checked-record-native-correction-source-v1");
	assert.equal(record.sourcePredecessorCommit,
		nestedCheckedRecordNativeCorrectionSourcePredecessor);
	assert.equal(record.draftParentCommit,
		nestedCheckedRecordNativeCorrectionDraftParent);
	assert.deepEqual(record.updates.map(update => update.path),
		nestedCheckedRecordNativeCorrectionChangedPaths);
	const nativePaths = new Set(nestedCheckedRecordNativeCorrectionNativePaths);
	for(const update of record.updates)
	{
		const expectedCommit = nativePaths.has(update.path)
			? nestedCheckedRecordNativeCorrectionSourcePredecessor
			: nestedCheckedRecordNativeCorrectionDraftParent;
		assert.equal(update.previousCommit, expectedCommit, update.path);
		const current = beforeFinRefinementSource(
			update.path, await readFile(update.path, "utf8"), update.currentSha256
		);
		assert.equal(sha256(current), update.currentSha256, update.path);
		const previous = execFileSync("git", [
			"show", `${expectedCommit}:${update.path}`
		], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
		assert.equal(reverseNestedCheckedRecordNativeCorrectionUpdate(current, update),
			previous);
		assert.equal(beforeNestedCheckedRecordNativeCorrectionSource(
			update.path, current, update.currentSha256), current);
		assert.equal(beforeNestedCheckedRecordNativeCorrectionSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
		assert.equal(beforeNestedCheckedRecordNativeCorrectionSource(
			update.path, current + "unknown"), current + "unknown");
		for(const mutate of [
			item => { item.path = "unknown"; }
			, item => { item.previousSha256 = "0".repeat(64); }
			, item => { item.currentSha256 = "0".repeat(64); }
			, item => { item.edits = []; }
			, item => { item.edits[0].start = -1; }
			, item => { item.edits[0].current += "unknown"; }
		]) {
			const changed = structuredClone(update); mutate(changed);
			assert.throws(() =>
				reverseNestedCheckedRecordNativeCorrectionUpdate(current, changed));
		}
	}
	t.diagnostic(`${record.pinCount} exact source pins refreshed`);
});

test("nested native corrections refresh only source pins", async () => {
	const path = "docs/type-surface.v1.json";
	const record = JSON.parse(await readFile(
		nestedCheckedRecordNativeCorrectionHistoryPath, "utf8"
	));
	const inventoryUpdate = record.updates.find(update => update.path === path);
	const currentText = beforeFinRefinementSource(
		path, await readFile(path, "utf8"), inventoryUpdate.currentSha256
	);
	const current = JSON.parse(currentText);
	const previous = JSON.parse(beforeNestedCheckedRecordNativeCorrectionSource(
		path, currentText, inventoryUpdate.previousSha256
	));
	const restored = beforeNestedCheckedRecordNativeCorrectionPins(current);
	assert.deepEqual(restored, previous);
	const byPath = new Map(record.updates.map(update => [update.path, update]));
	let refreshed = 0;
	for(const evidence of previous.evidence) for(const file of evidence.files)
	{
		const update = byPath.get(file.path);
		if(update && file.sha256 === update.previousSha256)
		{
			file.sha256 = update.currentSha256;
			refreshed++;
		}
	}
	assert.equal(refreshed, record.pinCount);
	assert.deepEqual(current, previous);
});

test("nested native correction updater refuses another HEAD before writing", async t => {
	const root = await mkdtemp(join(tmpdir(),
		"lean-bridge-nested-native-correction-history-guard-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = args => execFileSync("git", args, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-nested-checked-record-native-correction-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /draft-only at its exact integration parent/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
