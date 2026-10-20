/**
 * Test the reversible source transition for the WIT/WASI value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexWitArchiveSource
	, checkedRecordValueIndexWitArchiveAddedFileCount
	, checkedRecordValueIndexWitArchiveChangedPaths
	, checkedRecordValueIndexWitArchiveDraftParent
	, checkedRecordValueIndexWitArchiveFileCount
	, checkedRecordValueIndexWitArchiveFoundationAddedPaths
	, checkedRecordValueIndexWitArchiveHistoryPath
	, checkedRecordValueIndexWitArchiveIndexedFileCount
	, checkedRecordValueIndexWitArchiveIndexSha256
	, checkedRecordValueIndexWitArchivePredecessor
	, checkedRecordValueIndexWitArchiveRoot
	, reverseCheckedRecordValueIndexWitArchiveUpdate
} from "./checked-record-value-index-wit-archive-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

test("hosted WIT value-index archive has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexWitArchiveHistoryPath, "utf8"
	));
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "archive", "draftParentCommit", "milestone", "pathsSha256"
		, "predecessorCommit", "schemaVersion", "updates"
	]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-wit-archive-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexWitArchivePredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexWitArchiveDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexWitArchiveChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexWitArchiveFoundationAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexWitArchiveChangedPaths)));
	assert.deepEqual(record.archive, {
		root: checkedRecordValueIndexWitArchiveRoot
		, indexSha256: checkedRecordValueIndexWitArchiveIndexSha256
		, indexedFileCount: checkedRecordValueIndexWitArchiveIndexedFileCount
		, archiveFileCount: checkedRecordValueIndexWitArchiveFileCount
		, addedFileCount: checkedRecordValueIndexWitArchiveAddedFileCount
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexWitArchiveSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexWitArchivePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexWitArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexWitArchiveSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexWitArchiveSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCheckedRecordValueIndexWitArchiveSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	const sample = record.updates[0];
	const source = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeCheckedRecordValueIndexWitArchiveSource
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
		assert.throws(() => reverseCheckedRecordValueIndexWitArchiveUpdate(
			source, changed));
	}
});

test("hosted WIT value-index archive closes its exact committed tree", () => {
	const modified = names(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexWitArchivePredecessor
		, checkedRecordValueIndexWitArchiveDraftParent]);
	assert.deepEqual(modified
		, [...checkedRecordValueIndexWitArchiveChangedPaths].sort());
	const added = names(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexWitArchivePredecessor
		, checkedRecordValueIndexWitArchiveDraftParent]);
	assert.equal(added.length, checkedRecordValueIndexWitArchiveAddedFileCount);
	const indexBytes = Buffer.from(git(["show"
		, `${checkedRecordValueIndexWitArchiveDraftParent}:${checkedRecordValueIndexWitArchiveRoot}/index.json`]));
	assert.equal(sha256(indexBytes), checkedRecordValueIndexWitArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, checkedRecordValueIndexWitArchiveIndexedFileCount);
	assert.deepEqual(added, [
		`${checkedRecordValueIndexWitArchiveRoot}/index.json`
		, ...index.files.map(file =>
			`${checkedRecordValueIndexWitArchiveRoot}/${file.path}`)
		, ...checkedRecordValueIndexWitArchiveFoundationAddedPaths
	].sort());
});

test("hosted WIT value-index archive closes its source additions", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexWitArchiveHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexWitArchivePredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${checkedRecordValueIndexWitArchiveDraftParent}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	}
});
