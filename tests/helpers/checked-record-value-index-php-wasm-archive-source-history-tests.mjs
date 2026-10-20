/**
 * Test the reversible source transition for the PHP-Wasm value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeCheckedRecordValueIndexPhpWasmArchiveSource
	, checkedRecordValueIndexPhpWasmArchiveAddedFileCount
	, checkedRecordValueIndexPhpWasmArchiveChangedPaths
	, checkedRecordValueIndexPhpWasmArchiveDraftParent
	, checkedRecordValueIndexPhpWasmArchiveFileCount
	, checkedRecordValueIndexPhpWasmArchiveFoundationAddedPaths
	, checkedRecordValueIndexPhpWasmArchiveHistoryPath
	, checkedRecordValueIndexPhpWasmArchiveIndexedFileCount
	, checkedRecordValueIndexPhpWasmArchiveIndexSha256
	, checkedRecordValueIndexPhpWasmArchivePredecessor
	, checkedRecordValueIndexPhpWasmArchiveRoot
	, reverseCheckedRecordValueIndexPhpWasmArchiveUpdate
} from "./checked-record-value-index-php-wasm-archive-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

test("hosted PHP-Wasm value-index archive has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexPhpWasmArchiveHistoryPath, "utf8"
	));
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "archive", "draftParentCommit", "milestone", "pathsSha256"
		, "predecessorCommit", "schemaVersion", "updates"
	]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-php-wasm-archive-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexPhpWasmArchivePredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexPhpWasmArchiveDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexPhpWasmArchiveChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexPhpWasmArchiveFoundationAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexPhpWasmArchiveChangedPaths)));
	assert.deepEqual(record.archive, {
		root: checkedRecordValueIndexPhpWasmArchiveRoot
		, indexSha256: checkedRecordValueIndexPhpWasmArchiveIndexSha256
		, indexedFileCount: checkedRecordValueIndexPhpWasmArchiveIndexedFileCount
		, archiveFileCount: checkedRecordValueIndexPhpWasmArchiveFileCount
		, addedFileCount: checkedRecordValueIndexPhpWasmArchiveAddedFileCount
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexPhpWasmArchiveSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexPhpWasmArchivePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexPhpWasmArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexPhpWasmArchiveSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexPhpWasmArchiveSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCheckedRecordValueIndexPhpWasmArchiveSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	const sample = record.updates[0];
	const source = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeCheckedRecordValueIndexPhpWasmArchiveSource
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
		assert.throws(() => reverseCheckedRecordValueIndexPhpWasmArchiveUpdate(
			source, changed));
	}
});

test("hosted PHP-Wasm value-index archive closes its exact committed tree", () => {
	const modified = names(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexPhpWasmArchivePredecessor
		, checkedRecordValueIndexPhpWasmArchiveDraftParent]);
	assert.deepEqual(modified
		, [...checkedRecordValueIndexPhpWasmArchiveChangedPaths].sort());
	const added = names(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexPhpWasmArchivePredecessor
		, checkedRecordValueIndexPhpWasmArchiveDraftParent]);
	assert.equal(added.length, checkedRecordValueIndexPhpWasmArchiveAddedFileCount);
	const indexBytes = Buffer.from(git(["show"
		, `${checkedRecordValueIndexPhpWasmArchiveDraftParent}:${checkedRecordValueIndexPhpWasmArchiveRoot}/index.json`]));
	assert.equal(sha256(indexBytes), checkedRecordValueIndexPhpWasmArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, checkedRecordValueIndexPhpWasmArchiveIndexedFileCount);
	assert.deepEqual(added, [
		`${checkedRecordValueIndexPhpWasmArchiveRoot}/index.json`
		, ...index.files.map(file =>
			`${checkedRecordValueIndexPhpWasmArchiveRoot}/${file.path}`)
		, ...checkedRecordValueIndexPhpWasmArchiveFoundationAddedPaths
	].sort());
});

test("hosted PHP-Wasm value-index archive closes its source additions", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexPhpWasmArchiveHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexPhpWasmArchivePredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${checkedRecordValueIndexPhpWasmArchiveDraftParent}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	}
});
