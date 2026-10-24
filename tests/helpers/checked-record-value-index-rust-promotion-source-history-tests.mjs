/**
 * Test the reversible hosted Rust value-index promotion source layer.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexRustPromotionSource
	, checkedRecordValueIndexRustPromotionAddedSourcePaths
	, checkedRecordValueIndexRustPromotionChangedPaths
	, checkedRecordValueIndexRustPromotionDraftParent
	, checkedRecordValueIndexRustPromotionFoundationAddedPaths
	, checkedRecordValueIndexRustPromotionFoundationModifiedPaths
	, checkedRecordValueIndexRustPromotionHistoryPath
	, checkedRecordValueIndexRustPromotionPredecessor
	, reverseCheckedRecordValueIndexRustPromotionUpdate
} from "./checked-record-value-index-rust-promotion-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

test("hosted Rust value-index promotion has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustPromotionHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-rust-promotion-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexRustPromotionPredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexRustPromotionDraftParent);
	assert.deepEqual(record.foundation.modifiedPaths
		, checkedRecordValueIndexRustPromotionFoundationModifiedPaths);
	assert.deepEqual(record.foundation.addedPaths
		, checkedRecordValueIndexRustPromotionFoundationAddedPaths);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexRustPromotionChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexRustPromotionAddedSourcePaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexRustPromotionChangedPaths)));
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexRustPromotionSource);
		const previous = git(["show"
			, `${checkedRecordValueIndexRustPromotionPredecessor}:${update.path}`]);
		assert.equal(reverseCheckedRecordValueIndexRustPromotionUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexRustPromotionSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexRustPromotionSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCheckedRecordValueIndexRustPromotionSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	const sample = record.updates[0];
	const current = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeCheckedRecordValueIndexRustPromotionSource);
	for(const mutate of [
		item => { item.path = "unknown"; }
		, item => { item.previousSha256 = "0".repeat(64); }
		, item => { item.currentSha256 = "0".repeat(64); }
		, item => { item.edits = []; }
		, item => { item.edits[0].start = -1; }
		, item => { item.edits[0].current += "unknown"; }
	]) {
		const changed = structuredClone(sample); mutate(changed);
		assert.throws(() => reverseCheckedRecordValueIndexRustPromotionUpdate(
			current, changed));
	}
});

test("hosted Rust value-index promotion closes its exact committed tree", () => {
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexRustPromotionPredecessor
		, checkedRecordValueIndexRustPromotionDraftParent])
		, [...checkedRecordValueIndexRustPromotionFoundationModifiedPaths].sort());
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexRustPromotionPredecessor
		, checkedRecordValueIndexRustPromotionDraftParent])
		, [...checkedRecordValueIndexRustPromotionFoundationAddedPaths].sort());
});

test("hosted Rust value-index promotion closes every added source", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustPromotionHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256))
			, addition.currentSha256, addition.path);
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRustPromotionPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
	}
});
