/**
 * Test the reversible source transition for the Ruby value-index archive.
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
	beforeCheckedRecordValueIndexRubyArchiveSource
	, checkedRecordValueIndexRubyArchiveAddedFileCount
	, checkedRecordValueIndexRubyArchiveChangedPaths
	, checkedRecordValueIndexRubyArchiveDraftParent
	, checkedRecordValueIndexRubyArchiveFileCount
	, checkedRecordValueIndexRubyArchiveFoundationAddedPaths
	, checkedRecordValueIndexRubyArchiveHistoryPath
	, checkedRecordValueIndexRubyArchiveIndexedFileCount
	, checkedRecordValueIndexRubyArchiveIndexSha256
	, checkedRecordValueIndexRubyArchivePredecessor
	, checkedRecordValueIndexRubyArchiveRoot
	, reverseCheckedRecordValueIndexRubyArchiveUpdate
} from "./checked-record-value-index-ruby-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

test("hosted Ruby value-index archive has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRubyArchiveHistoryPath, "utf8"
	));
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "archive", "draftParentCommit", "milestone", "pathsSha256"
		, "predecessorCommit", "schemaVersion", "updates"
	]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "checked-record-value-index-ruby-archive-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexRubyArchivePredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexRubyArchiveDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexRubyArchiveChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexRubyArchiveFoundationAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexRubyArchiveChangedPaths)));
	assert.deepEqual(record.archive, {
		root: checkedRecordValueIndexRubyArchiveRoot
		, indexSha256: checkedRecordValueIndexRubyArchiveIndexSha256
		, indexedFileCount: checkedRecordValueIndexRubyArchiveIndexedFileCount
		, archiveFileCount: checkedRecordValueIndexRubyArchiveFileCount
		, addedFileCount: checkedRecordValueIndexRubyArchiveAddedFileCount
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexRubyArchiveSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexRubyArchivePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexRubyArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexRubyArchiveSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexRubyArchiveSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.equal(beforeCheckedRecordValueIndexRubyArchiveSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	const sample = record.updates[0];
	const source = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeCheckedRecordValueIndexRubyArchiveSource
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
		assert.throws(() => reverseCheckedRecordValueIndexRubyArchiveUpdate(
			source, changed));
	}
});

test("hosted Ruby value-index archive closes its exact committed tree", () => {
	const modified = names(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexRubyArchivePredecessor
		, checkedRecordValueIndexRubyArchiveDraftParent]);
	assert.deepEqual(modified
		, [...checkedRecordValueIndexRubyArchiveChangedPaths].sort());
	const added = names(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexRubyArchivePredecessor
		, checkedRecordValueIndexRubyArchiveDraftParent]);
	assert.equal(added.length, checkedRecordValueIndexRubyArchiveAddedFileCount);
	const indexBytes = Buffer.from(git(["show"
		, `${checkedRecordValueIndexRubyArchiveDraftParent}:${checkedRecordValueIndexRubyArchiveRoot}/index.json`]));
	assert.equal(sha256(indexBytes), checkedRecordValueIndexRubyArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, checkedRecordValueIndexRubyArchiveIndexedFileCount);
	assert.deepEqual(added, [
		`${checkedRecordValueIndexRubyArchiveRoot}/index.json`
		, ...index.files.map(file =>
			`${checkedRecordValueIndexRubyArchiveRoot}/${file.path}`)
		, ...checkedRecordValueIndexRubyArchiveFoundationAddedPaths
	].sort());
});

test("hosted Ruby value-index archive closes its source additions", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexRubyArchiveHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRubyArchivePredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${checkedRecordValueIndexRubyArchiveDraftParent}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	}
});

test("Ruby value-index archive writer refuses another checkout", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-bridge-value-index-ruby-archive-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const localGit = args => execFileSync("git", args, {
		cwd: root, env: environment, stdio: "pipe"
	});
	localGit(["init", "--quiet"]);
	localGit(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty", "--quiet"
		, "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-checked-record-value-index-ruby-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact archive commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
