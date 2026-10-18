#!/usr/bin/env node
/**
 * Record the hosted value-index checked-record .NET archive and refresh only
 * exact matching live source pins.
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
	checkedRecordValueIndexDotnetArchiveAddedFileCount
	, checkedRecordValueIndexDotnetArchiveAttributesSha256
	, checkedRecordValueIndexDotnetArchiveChangedPaths
	, checkedRecordValueIndexDotnetArchiveDraftParent
	, checkedRecordValueIndexDotnetArchiveFoundationModifiedPaths
	, checkedRecordValueIndexDotnetArchiveHistoryAddedPaths
	, checkedRecordValueIndexDotnetArchiveHistoryPath
	, checkedRecordValueIndexDotnetArchiveIndexSha256
	, checkedRecordValueIndexDotnetArchiveIndexedFileCount
	, checkedRecordValueIndexDotnetArchivePredecessor
	, checkedRecordValueIndexDotnetArchiveRoot
	, reverseCheckedRecordValueIndexDotnetArchiveUpdate
} from "../tests/helpers/checked-record-value-index-dotnet-archive-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths = checkedRecordValueIndexDotnetArchiveChangedPaths
	.filter(path => path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexDotnetArchiveDraftParent
	, "Value-index .NET archive history must stay on its exact archive commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexDotnetArchivePredecessor
	, "Value-index .NET archive must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, checkedRecordValueIndexDotnetArchiveDraftParent, "--"
	, checkedRecordValueIndexDotnetArchiveHistoryPath]).trim(), ""
, "Never rewrite committed value-index .NET archive history");
const draft = await readFile(
	checkedRecordValueIndexDotnetArchiveHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-dotnet-archive-source-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexDotnetArchivePredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexDotnetArchiveDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexDotnetArchivePredecessor
	, checkedRecordValueIndexDotnetArchiveDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexDotnetArchiveFoundationModifiedPaths].sort());
const archiveAdditions = git(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexDotnetArchivePredecessor
	, checkedRecordValueIndexDotnetArchiveDraftParent])
	.trim().split("\n").filter(Boolean).sort();
assert.equal(archiveAdditions.length
	, checkedRecordValueIndexDotnetArchiveAddedFileCount);
assert.ok(archiveAdditions.every(path => path.startsWith(
	checkedRecordValueIndexDotnetArchiveRoot + "/")));
const indexBytes = Buffer.from(git(["show"
	, `${checkedRecordValueIndexDotnetArchiveDraftParent}:${checkedRecordValueIndexDotnetArchiveRoot}/index.json`]));
assert.equal(sha256(indexBytes), checkedRecordValueIndexDotnetArchiveIndexSha256);
const index = JSON.parse(indexBytes);
assert.equal(index.files.length
	, checkedRecordValueIndexDotnetArchiveIndexedFileCount);
assert.deepEqual(archiveAdditions, [
	`${checkedRecordValueIndexDotnetArchiveRoot}/.gitattributes`
	, `${checkedRecordValueIndexDotnetArchiveRoot}/index.json`
	, ...index.files.map(file =>
		`${checkedRecordValueIndexDotnetArchiveRoot}/${file.path}`)
].sort());
assert.equal(sha256(git(["show"
	, `${checkedRecordValueIndexDotnetArchiveDraftParent}:${checkedRecordValueIndexDotnetArchiveRoot}/.gitattributes`]))
, checkedRecordValueIndexDotnetArchiveAttributesSha256);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexDotnetArchiveHistoryAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexDotnetArchiveHistoryAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexDotnetArchivePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexDotnetArchiveHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexDotnetArchivePredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${checkedRecordValueIndexDotnetArchivePredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const path of implementationPaths)
{
	const source = sources.get(path);
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(file.path === path && file.sha256 === previousSha256)
		{
			file.sha256 = currentSha256;
			count++;
		}
	if(count)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.equal(pinCount, 3
	, "Value-index .NET archive history must refresh three live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-dotnet-archive-history-"
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
	for(const path of checkedRecordValueIndexDotnetArchiveChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCheckedRecordValueIndexDotnetArchiveUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-dotnet-archive-source-v1"
		, predecessorCommit: checkedRecordValueIndexDotnetArchivePredecessor
		, draftParentCommit: checkedRecordValueIndexDotnetArchiveDraftParent
		, archive: {
			root: checkedRecordValueIndexDotnetArchiveRoot
			, indexSha256: checkedRecordValueIndexDotnetArchiveIndexSha256
			, attributesSha256: checkedRecordValueIndexDotnetArchiveAttributesSha256
			, indexedFileCount: checkedRecordValueIndexDotnetArchiveIndexedFileCount
			, addedFileCount: checkedRecordValueIndexDotnetArchiveAddedFileCount
		}
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexDotnetArchiveChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(
		checkedRecordValueIndexDotnetArchiveHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} value-index .NET archive transitions, ${additions.length} additions, ${checkedRecordValueIndexDotnetArchiveAddedFileCount} archive files and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
