/**
 * Test the reversible source transition for hosted Rust value-index evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexRustArchiveSource
	, checkedRecordValueIndexRustArchiveAddedFileCount
	, checkedRecordValueIndexRustArchiveChangedPaths
	, checkedRecordValueIndexRustArchiveDraftParent
	, checkedRecordValueIndexRustArchiveFileCount
	, checkedRecordValueIndexRustArchiveFoundationAddedPaths
	, checkedRecordValueIndexRustArchiveHistoryPath
	, checkedRecordValueIndexRustArchiveIndexedFileCount
	, checkedRecordValueIndexRustArchiveIndexSha256
	, checkedRecordValueIndexRustArchivePredecessor
	, checkedRecordValueIndexRustArchiveRoot
	, reverseCheckedRecordValueIndexRustArchiveUpdate
} from "./checked-record-value-index-rust-archive-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

test("hosted Rust value-index archive has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustArchiveHistoryPath, "utf8"));
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "archive", "draftParentCommit", "milestone", "pathsSha256"
		, "predecessorCommit", "schemaVersion", "updates"
	]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "checked-record-value-index-rust-archive-source-v1");
	assert.equal(record.predecessorCommit, checkedRecordValueIndexRustArchivePredecessor);
	assert.equal(record.draftParentCommit, checkedRecordValueIndexRustArchiveDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexRustArchiveChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexRustArchiveFoundationAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexRustArchiveChangedPaths)));
	assert.deepEqual(record.archive, {
		root: checkedRecordValueIndexRustArchiveRoot
		, indexSha256: checkedRecordValueIndexRustArchiveIndexSha256
		, indexedFileCount: checkedRecordValueIndexRustArchiveIndexedFileCount
		, archiveFileCount: checkedRecordValueIndexRustArchiveFileCount
		, addedFileCount: checkedRecordValueIndexRustArchiveAddedFileCount
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexRustArchiveSource);
		const previous = git(["show"
			, `${checkedRecordValueIndexRustArchivePredecessor}:${update.path}`]);
		assert.equal(reverseCheckedRecordValueIndexRustArchiveUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexRustArchiveSource(update.path, current)
			, previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexRustArchiveSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCheckedRecordValueIndexRustArchiveSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	const sample = record.updates[0];
	const source = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeCheckedRecordValueIndexRustArchiveSource);
	for(const mutate of [
		item => { item.path = "unknown"; }
		, item => { item.previousSha256 = "0".repeat(64); }
		, item => { item.currentSha256 = "0".repeat(64); }
		, item => { item.edits = []; }
		, item => { item.edits[0].start = -1; }
		, item => { item.edits[0].current += "unknown"; }
	]) {
		const changed = structuredClone(sample); mutate(changed);
		assert.throws(() => reverseCheckedRecordValueIndexRustArchiveUpdate(
			source, changed));
	}
});

test("hosted Rust value-index archive closes its exact committed tree", () => {
	assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexRustArchivePredecessor
		, checkedRecordValueIndexRustArchiveDraftParent])
		, [...checkedRecordValueIndexRustArchiveChangedPaths].sort());
	const added = names(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexRustArchivePredecessor
		, checkedRecordValueIndexRustArchiveDraftParent]);
	assert.equal(added.length, checkedRecordValueIndexRustArchiveAddedFileCount);
	const indexBytes = Buffer.from(git(["show"
		, `${checkedRecordValueIndexRustArchiveDraftParent}:${checkedRecordValueIndexRustArchiveRoot}/index.json`]));
	assert.equal(sha256(indexBytes), checkedRecordValueIndexRustArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length, checkedRecordValueIndexRustArchiveIndexedFileCount);
	assert.deepEqual(added, [
		`${checkedRecordValueIndexRustArchiveRoot}/index.json`
		, ...index.files.map(file => `${checkedRecordValueIndexRustArchiveRoot}/${file.path}`)
		, ...checkedRecordValueIndexRustArchiveFoundationAddedPaths
	].sort());
});

test("hosted Rust value-index archive closes its source additions", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRustArchiveHistoryPath, "utf8"));
	for(const addition of record.additions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRustArchivePredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${checkedRecordValueIndexRustArchiveDraftParent}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	}
});
