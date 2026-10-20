/**
 * Test the reversible source transition for the hosted Perl value-index
 * archive.
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
	beforeCheckedRecordValueIndexPerlArchiveSource
	, checkedRecordValueIndexPerlArchiveAddedFileCount
	, checkedRecordValueIndexPerlArchiveChangedPaths
	, checkedRecordValueIndexPerlArchiveDraftParent
	, checkedRecordValueIndexPerlArchiveFileCount
	, checkedRecordValueIndexPerlArchiveFoundationAddedPaths
	, checkedRecordValueIndexPerlArchiveHistoryPath
	, checkedRecordValueIndexPerlArchiveIndexedFileCount
	, checkedRecordValueIndexPerlArchiveIndexSha256
	, checkedRecordValueIndexPerlArchivePredecessor
	, checkedRecordValueIndexPerlArchiveRoot
	, reverseCheckedRecordValueIndexPerlArchiveUpdate
} from "./checked-record-value-index-perl-archive-source-history.mjs";
import { finRefinementNormalizationPaths } from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();

test("hosted Perl value-index archive has one reversible lineage", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexPerlArchiveHistoryPath, "utf8"
	));
	assert.deepEqual(Object.keys(record).sort(), [
		"additions", "archive", "draftParentCommit", "milestone", "pathsSha256"
		, "predecessorCommit", "schemaVersion", "updates"
	]);
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "checked-record-value-index-perl-archive-source-v1");
	assert.equal(record.predecessorCommit
		, checkedRecordValueIndexPerlArchivePredecessor);
	assert.equal(record.draftParentCommit
		, checkedRecordValueIndexPerlArchiveDraftParent);
	assert.deepEqual(record.updates.map(update => update.path)
		, checkedRecordValueIndexPerlArchiveChangedPaths);
	assert.deepEqual(record.additions.map(item => item.path)
		, checkedRecordValueIndexPerlArchiveFoundationAddedPaths);
	assert.equal(record.pathsSha256, sha256(JSON.stringify(
		checkedRecordValueIndexPerlArchiveChangedPaths)));
	assert.deepEqual(record.archive, {
		root: checkedRecordValueIndexPerlArchiveRoot
		, indexSha256: checkedRecordValueIndexPerlArchiveIndexSha256
		, indexedFileCount: checkedRecordValueIndexPerlArchiveIndexedFileCount
		, archiveFileCount: checkedRecordValueIndexPerlArchiveFileCount
		, addedFileCount: checkedRecordValueIndexPerlArchiveAddedFileCount
	});
	for(const update of record.updates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeCheckedRecordValueIndexPerlArchiveSource
		);
		const previous = git(["show"
			, `${checkedRecordValueIndexPerlArchivePredecessor}:${update.path}`]);
		assert.equal(sha256(current), update.currentSha256, update.path);
		assert.equal(sha256(previous), update.previousSha256, update.path);
		assert.equal(reverseCheckedRecordValueIndexPerlArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexPerlArchiveSource(
			update.path, current), previous, update.path);
		assert.equal(beforeCheckedRecordValueIndexPerlArchiveSource(
			update.path, current, update.currentSha256), current, update.path);
		assert.ok(finRefinementNormalizationPaths.includes(update.path));
		assert.equal(beforeCheckedRecordValueIndexPerlArchiveSource(
			update.path, current + "unknown"), current + "unknown", update.path);
	}
	const sample = record.updates[0];
	const source = await sourceAtFinHistoryMilestone(
		sample.path, sample.currentSha256
		, beforeCheckedRecordValueIndexPerlArchiveSource
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
		assert.throws(() => reverseCheckedRecordValueIndexPerlArchiveUpdate(
			source, changed));
	}
});

test("hosted Perl value-index archive closes its exact committed tree", () => {
	const modified = names(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexPerlArchivePredecessor
		, checkedRecordValueIndexPerlArchiveDraftParent]);
	assert.deepEqual(modified
		, [...checkedRecordValueIndexPerlArchiveChangedPaths].sort());
	const added = names(["diff", "--name-only", "--diff-filter=A"
		, checkedRecordValueIndexPerlArchivePredecessor
		, checkedRecordValueIndexPerlArchiveDraftParent]);
	assert.equal(added.length, checkedRecordValueIndexPerlArchiveAddedFileCount);
	const indexBytes = Buffer.from(git(["show"
		, `${checkedRecordValueIndexPerlArchiveDraftParent}:${checkedRecordValueIndexPerlArchiveRoot}/index.json`]));
	assert.equal(sha256(indexBytes), checkedRecordValueIndexPerlArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length, checkedRecordValueIndexPerlArchiveIndexedFileCount);
	assert.deepEqual(added, [
		`${checkedRecordValueIndexPerlArchiveRoot}/index.json`
		, ...index.files.map(file => `${checkedRecordValueIndexPerlArchiveRoot}/${file.path}`)
		, ...checkedRecordValueIndexPerlArchiveFoundationAddedPaths
	].sort());
});

test("hosted Perl value-index archive closes its source additions", async () => {
	const record = JSON.parse(await readFile(
		checkedRecordValueIndexPerlArchiveHistoryPath, "utf8"
	));
	for(const addition of record.additions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexPerlArchivePredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${checkedRecordValueIndexPerlArchiveDraftParent}:${addition.path}`]))
			, addition.currentSha256, addition.path);
	}
});

test("Perl value-index archive writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-perl-archive-"));
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
		"scripts/update-checked-record-value-index-perl-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /must stay on its exact archive commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
