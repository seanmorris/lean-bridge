#!/usr/bin/env node
/**
 * Record the immutable Ruby value-index archive source transition.
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
	checkedRecordValueIndexRubyArchiveAddedFileCount
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
} from "../tests/helpers/checked-record-value-index-ruby-archive-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const source = path => git([
	"show", `${checkedRecordValueIndexRubyArchiveDraftParent}:${path}`
]);

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexRubyArchiveDraftParent
	, "Ruby archive history must stay on its exact archive commit");
assert.equal(git(["rev-parse", checkedRecordValueIndexRubyArchivePredecessor]).trim()
	, checkedRecordValueIndexRubyArchivePredecessor
	, "Ruby archive history must keep its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexRubyArchiveDraftParent}:${checkedRecordValueIndexRubyArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed Ruby archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, checkedRecordValueIndexRubyArchiveDraftParent, "--"
	, checkedRecordValueIndexRubyArchiveRoot]);
const index = JSON.parse(source(
	`${checkedRecordValueIndexRubyArchiveRoot}/index.json`));
assert.equal(index.files.length
	, checkedRecordValueIndexRubyArchiveIndexedFileCount);
assert.equal(
	sha256(source(`${checkedRecordValueIndexRubyArchiveRoot}/index.json`))
	, checkedRecordValueIndexRubyArchiveIndexSha256
);
assert.equal(archivePaths.length, checkedRecordValueIndexRubyArchiveFileCount);
assert.deepEqual(archivePaths, [
	`${checkedRecordValueIndexRubyArchiveRoot}/index.json`
	, ...index.files.map(entry =>
		`${checkedRecordValueIndexRubyArchiveRoot}/${entry.path}`)
].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexRubyArchivePredecessor
	, checkedRecordValueIndexRubyArchiveDraftParent])
, [...checkedRecordValueIndexRubyArchiveChangedPaths].sort());
const expectedAdded = [
	...archivePaths, ...checkedRecordValueIndexRubyArchiveFoundationAddedPaths
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexRubyArchivePredecessor
	, checkedRecordValueIndexRubyArchiveDraftParent]), expectedAdded);
assert.equal(expectedAdded.length
	, checkedRecordValueIndexRubyArchiveAddedFileCount);

const draft = await readFile(
	checkedRecordValueIndexRubyArchiveHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-ruby-archive-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexRubyArchivePredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexRubyArchiveDraftParent);
}

const sources = new Map();
for(const path of checkedRecordValueIndexRubyArchiveChangedPaths)
{
	const previous = git([
		"show", `${checkedRecordValueIndexRubyArchivePredecessor}:${path}`
	]);
	const current = source(path);
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = checkedRecordValueIndexRubyArchiveFoundationAddedPaths.map(
	path => {
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexRubyArchivePredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		return { path, currentSha256: sha256(source(path)) };
	}
);
const root = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-ruby-archive-history-"));
try
{
	const edits = async (previous, current) => {
		const before = join(root, "before"), after = join(root, "after");
		await writeFile(before, previous); await writeFile(after, current);
		let diff;
		try
		{
			diff = execFileSync("diff", [
				"--speed-large-files", "--unified=0", before, after
			], { encoding: "utf8" });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const matches = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)];
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
	for(const path of checkedRecordValueIndexRubyArchiveChangedPaths)
	{
		const value = sources.get(path);
		const update = {
			path, previousSha256: sha256(value.previous)
			, currentSha256: sha256(value.current)
			, edits: await edits(value.previous, value.current)
		};
		assert.equal(reverseCheckedRecordValueIndexRubyArchiveUpdate(
			value.current, update), value.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexRubyArchiveHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-ruby-archive-source-v1"
			, predecessorCommit: checkedRecordValueIndexRubyArchivePredecessor
			, draftParentCommit: checkedRecordValueIndexRubyArchiveDraftParent
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexRubyArchiveChangedPaths))
			, archive: {
				root: checkedRecordValueIndexRubyArchiveRoot
				, indexSha256: checkedRecordValueIndexRubyArchiveIndexSha256
				, indexedFileCount: checkedRecordValueIndexRubyArchiveIndexedFileCount
				, archiveFileCount: checkedRecordValueIndexRubyArchiveFileCount
				, addedFileCount: checkedRecordValueIndexRubyArchiveAddedFileCount
			}
			, additions, updates
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} Ruby archive transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(root, { recursive: true, force: true });
}
