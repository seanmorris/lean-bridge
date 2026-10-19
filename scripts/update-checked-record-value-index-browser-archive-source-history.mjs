#!/usr/bin/env node
/**
 * Record the hosted value-index browser archive and its exact source changes.
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
	checkedRecordValueIndexBrowserArchiveAddedFileCount
	, checkedRecordValueIndexBrowserArchiveAddedSourcePaths
	, checkedRecordValueIndexBrowserArchiveChangedPaths
	, checkedRecordValueIndexBrowserArchiveDraftParent
	, checkedRecordValueIndexBrowserArchiveFoundationAddedPaths
	, checkedRecordValueIndexBrowserArchiveFoundationModifiedPaths
	, checkedRecordValueIndexBrowserArchiveHistoryAddedPaths
	, checkedRecordValueIndexBrowserArchiveHistoryPath
	, checkedRecordValueIndexBrowserArchiveIndexSha256
	, checkedRecordValueIndexBrowserArchiveIndexedFileCount
	, checkedRecordValueIndexBrowserArchivePredecessor
	, checkedRecordValueIndexBrowserArchiveRoot
	, reverseCheckedRecordValueIndexBrowserArchiveUpdate
} from "../tests/helpers/checked-record-value-index-browser-archive-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexBrowserArchiveDraftParent
	, "Value-index browser archive history must stay on its exact archive commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexBrowserArchivePredecessor
	, "Value-index browser archive must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, checkedRecordValueIndexBrowserArchiveDraftParent, "--"
	, checkedRecordValueIndexBrowserArchiveHistoryPath]).trim(), ""
, "Never rewrite committed value-index browser archive history");
const draft = await readFile(
	checkedRecordValueIndexBrowserArchiveHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-browser-archive-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexBrowserArchivePredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexBrowserArchiveDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexBrowserArchivePredecessor
	, checkedRecordValueIndexBrowserArchiveDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexBrowserArchiveFoundationModifiedPaths].sort());
const archiveAdditions = git(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexBrowserArchivePredecessor
	, checkedRecordValueIndexBrowserArchiveDraftParent])
	.trim().split("\n").filter(Boolean).sort();
assert.equal(archiveAdditions.length
	, checkedRecordValueIndexBrowserArchiveAddedFileCount
		+ checkedRecordValueIndexBrowserArchiveFoundationAddedPaths.length);
const indexBytes = Buffer.from(git(["show"
	, `${checkedRecordValueIndexBrowserArchiveDraftParent}:${checkedRecordValueIndexBrowserArchiveRoot}/index.json`]));
assert.equal(sha256(indexBytes)
	, checkedRecordValueIndexBrowserArchiveIndexSha256);
const index = JSON.parse(indexBytes);
assert.equal(index.files.length
	, checkedRecordValueIndexBrowserArchiveIndexedFileCount);
assert.deepEqual(archiveAdditions, [
	`${checkedRecordValueIndexBrowserArchiveRoot}/index.json`
	, ...index.files.map(file =>
		`${checkedRecordValueIndexBrowserArchiveRoot}/${file.path}`)
	, ...checkedRecordValueIndexBrowserArchiveFoundationAddedPaths
].sort());
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexBrowserArchiveHistoryAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexBrowserArchiveHistoryAddedPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--"
	, ...checkedRecordValueIndexBrowserArchiveChangedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexBrowserArchiveChangedPaths].sort());

const sources = new Map();
for(const path of checkedRecordValueIndexBrowserArchiveChangedPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexBrowserArchivePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexBrowserArchiveAddedSourcePaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexBrowserArchivePredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-browser-archive-history-"
));
try
{
	const edits = async (previous, current) => {
		const previousPath = join(directory, "previous");
		const currentPath = join(directory, "current");
		await writeFile(previousPath, previous);
		await writeFile(currentPath, current);
		let diff;
		try
		{
			diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
				, previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
		}
		catch(error)
		{
			if(error.status !== 1 || typeof error.stdout !== "string") throw error;
			diff = error.stdout;
		}
		const previousLines = previous.split(/(?<=\n)/u);
		const currentLines = current.split(/(?<=\n)/u);
		const result = [...diff.matchAll(
			/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
		)].map(match => {
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
		assert.ok(result.length > 0);
		return result;
	};
	const updates = [];
	for(const path of checkedRecordValueIndexBrowserArchiveChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexBrowserArchiveUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-browser-archive-source-v1"
		, predecessorCommit: checkedRecordValueIndexBrowserArchivePredecessor
		, draftParentCommit: checkedRecordValueIndexBrowserArchiveDraftParent
		, archive: {
			root: checkedRecordValueIndexBrowserArchiveRoot
			, indexSha256: checkedRecordValueIndexBrowserArchiveIndexSha256
			, indexedFileCount: checkedRecordValueIndexBrowserArchiveIndexedFileCount
			, addedFileCount: checkedRecordValueIndexBrowserArchiveAddedFileCount
		}
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexBrowserArchiveChangedPaths))
		, pinCount: 0, pinUpdates: [], additions, updates
	}, null, 2) + "\n";
	await writeFile(checkedRecordValueIndexBrowserArchiveHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} value-index browser archive transitions, ${additions.length} source additions and ${checkedRecordValueIndexBrowserArchiveAddedFileCount} archive files.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
