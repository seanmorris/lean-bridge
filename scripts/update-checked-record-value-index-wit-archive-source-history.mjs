#!/usr/bin/env node
/**
 * Record the immutable WIT/WASI value-index archive source transition.
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
	checkedRecordValueIndexWitArchiveAddedFileCount
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
} from "../tests/helpers/checked-record-value-index-wit-archive-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 128 * 1024 * 1024
});
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const source = path => git([
	"show", `${checkedRecordValueIndexWitArchiveDraftParent}:${path}`
]);

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexWitArchiveDraftParent
	, "WIT archive history must stay on its exact archive commit");
assert.equal(git(["rev-parse", checkedRecordValueIndexWitArchivePredecessor]).trim()
	, checkedRecordValueIndexWitArchivePredecessor
	, "WIT archive history must keep its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${checkedRecordValueIndexWitArchiveDraftParent}:${checkedRecordValueIndexWitArchiveHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed WIT archive history");

const archivePaths = names(["ls-tree", "-r", "--name-only"
	, checkedRecordValueIndexWitArchiveDraftParent, "--"
	, checkedRecordValueIndexWitArchiveRoot]);
const index = JSON.parse(source(
	`${checkedRecordValueIndexWitArchiveRoot}/index.json`));
assert.equal(index.files.length
	, checkedRecordValueIndexWitArchiveIndexedFileCount);
assert.equal(
	sha256(source(`${checkedRecordValueIndexWitArchiveRoot}/index.json`))
	, checkedRecordValueIndexWitArchiveIndexSha256
);
assert.equal(archivePaths.length, checkedRecordValueIndexWitArchiveFileCount);
assert.deepEqual(archivePaths, [
	`${checkedRecordValueIndexWitArchiveRoot}/index.json`
	, ...index.files.map(entry =>
		`${checkedRecordValueIndexWitArchiveRoot}/${entry.path}`)
].sort());
assert.deepEqual(
	names(["diff", "--name-only", "--diff-filter=M"
		, checkedRecordValueIndexWitArchivePredecessor
		, checkedRecordValueIndexWitArchiveDraftParent])
	, [...checkedRecordValueIndexWitArchiveChangedPaths].sort()
);
const expectedAdded = [
	...archivePaths, ...checkedRecordValueIndexWitArchiveFoundationAddedPaths
].sort();
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexWitArchivePredecessor
	, checkedRecordValueIndexWitArchiveDraftParent]), expectedAdded);
assert.equal(expectedAdded.length
	, checkedRecordValueIndexWitArchiveAddedFileCount);

const draft = await readFile(
	checkedRecordValueIndexWitArchiveHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-wit-archive-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexWitArchivePredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexWitArchiveDraftParent);
}

const sources = new Map();
for(const path of checkedRecordValueIndexWitArchiveChangedPaths)
{
	const previous = git([
		"show", `${checkedRecordValueIndexWitArchivePredecessor}:${path}`
	]);
	const current = source(path);
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = checkedRecordValueIndexWitArchiveFoundationAddedPaths.map(
	path => {
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${checkedRecordValueIndexWitArchivePredecessor}:${path}`]
			, { stdio: "ignore" }).status, 0, path);
		return { path, currentSha256: sha256(source(path)) };
	}
);
const root = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-wit-archive-history-"));
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
	for(const path of checkedRecordValueIndexWitArchiveChangedPaths)
	{
		const value = sources.get(path);
		const update = {
			path, previousSha256: sha256(value.previous)
			, currentSha256: sha256(value.current)
			, edits: await edits(value.previous, value.current)
		};
		assert.equal(reverseCheckedRecordValueIndexWitArchiveUpdate(
			value.current, update), value.previous, path);
		updates.push(update);
	}
	await writeFile(checkedRecordValueIndexWitArchiveHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "checked-record-value-index-wit-archive-source-v1"
			, predecessorCommit: checkedRecordValueIndexWitArchivePredecessor
			, draftParentCommit: checkedRecordValueIndexWitArchiveDraftParent
			, pathsSha256: sha256(JSON.stringify(
				checkedRecordValueIndexWitArchiveChangedPaths))
			, archive: {
				root: checkedRecordValueIndexWitArchiveRoot
				, indexSha256: checkedRecordValueIndexWitArchiveIndexSha256
				, indexedFileCount: checkedRecordValueIndexWitArchiveIndexedFileCount
				, archiveFileCount: checkedRecordValueIndexWitArchiveFileCount
				, addedFileCount: checkedRecordValueIndexWitArchiveAddedFileCount
			}
			, additions, updates
		}, null, 2) + "\n", draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} WIT archive transitions and ${additions.length} source additions.\n`);
}
finally
{
	await rm(root, { recursive: true, force: true });
}
