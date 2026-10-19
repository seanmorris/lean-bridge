#!/usr/bin/env node
/**
 * Record the immutable native-PHP value-index archive source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	checkedRecordValueIndexPhpArchiveAddedFileCount
	, checkedRecordValueIndexPhpArchiveChangedPaths
	, checkedRecordValueIndexPhpArchiveDraftParent
	, checkedRecordValueIndexPhpArchiveFoundationAddedPaths
	, checkedRecordValueIndexPhpArchiveHistoryPath
	, checkedRecordValueIndexPhpArchiveIndexedFileCount
	, checkedRecordValueIndexPhpArchiveIndexSha256
	, checkedRecordValueIndexPhpArchivePredecessor
	, checkedRecordValueIndexPhpArchiveRoot
	, reverseCheckedRecordValueIndexPhpArchiveUpdate
} from "../tests/helpers/checked-record-value-index-php-archive-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const source = path => git(["show"
	, `${checkedRecordValueIndexPhpArchiveDraftParent}:${path}`]);

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexPhpArchiveDraftParent
	, "PHP archive history must stay on its exact archive commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexPhpArchivePredecessor
	, "PHP archive history must keep its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexPhpArchiveDraftParent}:${checkedRecordValueIndexPhpArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed PHP archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, checkedRecordValueIndexPhpArchiveDraftParent, "--"
	, checkedRecordValueIndexPhpArchiveRoot]);
const index = JSON.parse(source(`${checkedRecordValueIndexPhpArchiveRoot}/index.json`));
assert.equal(index.files.length, checkedRecordValueIndexPhpArchiveIndexedFileCount);
assert.equal(sha256(source(`${checkedRecordValueIndexPhpArchiveRoot}/index.json`))
	, checkedRecordValueIndexPhpArchiveIndexSha256);
assert.deepEqual(archivePaths, [
	`${checkedRecordValueIndexPhpArchiveRoot}/index.json`
	, ...index.files.map(entry => `${checkedRecordValueIndexPhpArchiveRoot}/${entry.path}`)
].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexPhpArchivePredecessor
	, checkedRecordValueIndexPhpArchiveDraftParent])
, [...checkedRecordValueIndexPhpArchiveChangedPaths].sort());
const expectedAdded = [
	...archivePaths, ...checkedRecordValueIndexPhpArchiveFoundationAddedPaths
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexPhpArchivePredecessor
	, checkedRecordValueIndexPhpArchiveDraftParent]), expectedAdded);
assert.equal(archivePaths.length + checkedRecordValueIndexPhpArchiveFoundationAddedPaths.length
	, checkedRecordValueIndexPhpArchiveAddedFileCount);

const draft = await readFile(checkedRecordValueIndexPhpArchiveHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "checked-record-value-index-php-archive-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexPhpArchivePredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexPhpArchiveDraftParent);
}

const sources = new Map();
for(const path of checkedRecordValueIndexPhpArchiveChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexPhpArchivePredecessor}:${path}`]);
	const current = source(path);
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = checkedRecordValueIndexPhpArchiveFoundationAddedPaths.map(path => {
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexPhpArchivePredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	return { path, currentSha256: sha256(source(path)) };
});
const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-php-archive-history-"));
try
{
	const edits = async (previous, current) => {
		const before = join(root, "before"), after = join(root, "after");
		await writeFile(before, previous); await writeFile(after, current);
		let diff;
		try
		{ diff = execFileSync("diff", ["--speed-large-files", "--unified=0", before, after], { encoding: "utf8" }); }
		catch(error)
		{ if(error.status !== 1 || typeof error.stdout !== "string") throw error; diff = error.stdout; }
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const matches = [...diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)];
		assert.ok(matches.length > 0);
		return matches.map(match => {
			const previousCount = Number(match[2] ?? 1);
			const currentCount = Number(match[4] ?? 1);
			const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
			const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
			return {
				start: currentLines.slice(0, currentStart).join("").length
				, previous: previousLines.slice(previousStart
					, previousStart + previousCount).join("")
				, current: currentLines.slice(currentStart
					, currentStart + currentCount).join("")
			};
		});
	};
	const updates = [];
	for(const path of checkedRecordValueIndexPhpArchiveChangedPaths)
	{
		const value = sources.get(path);
		const update = {
			path, previousSha256: sha256(value.previous)
			, currentSha256: sha256(value.current)
			, edits: await edits(value.previous, value.current)
		};
		assert.equal(reverseCheckedRecordValueIndexPhpArchiveUpdate(
			value.current, update), value.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexPhpArchiveHistoryPath, JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-php-archive-source-v1"
		, predecessorCommit: checkedRecordValueIndexPhpArchivePredecessor
		, draftParentCommit: checkedRecordValueIndexPhpArchiveDraftParent
		, pathsSha256: sha256(JSON.stringify(checkedRecordValueIndexPhpArchiveChangedPaths))
		, archive: {
			root: checkedRecordValueIndexPhpArchiveRoot
			, indexSha256: checkedRecordValueIndexPhpArchiveIndexSha256
			, indexedFileCount: checkedRecordValueIndexPhpArchiveIndexedFileCount
			, addedFileCount: checkedRecordValueIndexPhpArchiveAddedFileCount
		}
		, additions, updates
	}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} PHP archive transitions and ${additions.length} source additions.\n`);
}
finally
{ await rm(root, { recursive: true, force: true }); }
