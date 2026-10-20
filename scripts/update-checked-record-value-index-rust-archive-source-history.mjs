#!/usr/bin/env node
/**
 * Record the immutable Rust value-index archive source transition.
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
	checkedRecordValueIndexRustArchiveAddedFileCount
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
} from "../tests/helpers/checked-record-value-index-rust-archive-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const source = path => git([
	"show", `${checkedRecordValueIndexRustArchiveDraftParent}:${path}`
]);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexRustArchiveDraftParent
	, "Rust archive history must stay on its exact archive-verifier commit");
assert.equal(git(["rev-parse", checkedRecordValueIndexRustArchivePredecessor]).trim()
	, checkedRecordValueIndexRustArchivePredecessor);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexRustArchiveDraftParent}:${checkedRecordValueIndexRustArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed Rust archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, checkedRecordValueIndexRustArchiveDraftParent, "--"
	, checkedRecordValueIndexRustArchiveRoot]);
const index = JSON.parse(source(`${checkedRecordValueIndexRustArchiveRoot}/index.json`));
assert.equal(index.files.length, checkedRecordValueIndexRustArchiveIndexedFileCount);
assert.equal(sha256(source(`${checkedRecordValueIndexRustArchiveRoot}/index.json`))
	, checkedRecordValueIndexRustArchiveIndexSha256);
assert.equal(archivePaths.length, checkedRecordValueIndexRustArchiveFileCount);
assert.deepEqual(archivePaths, [
	`${checkedRecordValueIndexRustArchiveRoot}/index.json`
	, ...index.files.map(entry => `${checkedRecordValueIndexRustArchiveRoot}/${entry.path}`)
].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexRustArchivePredecessor
	, checkedRecordValueIndexRustArchiveDraftParent])
, [...checkedRecordValueIndexRustArchiveChangedPaths].sort());
const expectedAdded = [
	...archivePaths, ...checkedRecordValueIndexRustArchiveFoundationAddedPaths
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexRustArchivePredecessor
	, checkedRecordValueIndexRustArchiveDraftParent]), expectedAdded);
assert.equal(expectedAdded.length, checkedRecordValueIndexRustArchiveAddedFileCount);

const draft = await readFile(
	checkedRecordValueIndexRustArchiveHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "checked-record-value-index-rust-archive-source-v1");
	assert.equal(draft.predecessorCommit, checkedRecordValueIndexRustArchivePredecessor);
	assert.equal(draft.draftParentCommit, checkedRecordValueIndexRustArchiveDraftParent);
}
const sources = new Map();
for(const path of checkedRecordValueIndexRustArchiveChangedPaths)
{
	const previous = git(["show", `${checkedRecordValueIndexRustArchivePredecessor}:${path}`]);
	const current = source(path);
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = checkedRecordValueIndexRustArchiveFoundationAddedPaths.map(path => {
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexRustArchivePredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
	return { path, currentSha256: sha256(source(path)) };
});
const root = await mkdtemp(join(tmpdir(), "lean-bridge-value-index-rust-archive-history-"));
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
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu)];
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
	for(const path of checkedRecordValueIndexRustArchiveChangedPaths)
	{
		const value = sources.get(path);
		const update = {
			path, previousSha256: sha256(value.previous)
			, currentSha256: sha256(value.current)
			, edits: await edits(value.previous, value.current)
		};
		assert.equal(reverseCheckedRecordValueIndexRustArchiveUpdate(
			value.current, update), value.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexRustArchiveHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-rust-archive-source-v1"
			, predecessorCommit: checkedRecordValueIndexRustArchivePredecessor
			, draftParentCommit: checkedRecordValueIndexRustArchiveDraftParent
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexRustArchiveChangedPaths))
			, archive: {
				root: checkedRecordValueIndexRustArchiveRoot
				, indexSha256: checkedRecordValueIndexRustArchiveIndexSha256
				, indexedFileCount: checkedRecordValueIndexRustArchiveIndexedFileCount
				, archiveFileCount: checkedRecordValueIndexRustArchiveFileCount
				, addedFileCount: checkedRecordValueIndexRustArchiveAddedFileCount
			}
			, additions, updates
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} Rust archive transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(root, { recursive: true, force: true });
}
