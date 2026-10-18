#!/usr/bin/env node
/**
 * Record the .NET result-only/Core inventory repair and refresh only matching
 * live source pins.
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
	checkedRecordValueIndexDotnetResultOnlyCoreRepairAddedPaths
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairFoundationPaths
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairHistoryPath
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor
	, reverseCheckedRecordValueIndexDotnetResultOnlyCoreRepairUpdate
} from "../tests/helpers/checked-record-value-index-dotnet-result-only-core-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths
	= checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths.filter(path =>
		path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent
	, ".NET result-only/Core history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor
	, ".NET result-only/Core repair must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent, "--"
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairHistoryPath]).trim(), ""
, "Never rewrite committed .NET result-only/Core repair history");
const draft = await readFile(
	checkedRecordValueIndexDotnetResultOnlyCoreRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "checked-record-value-index-dotnet-result-only-core-repair-v1");
	assert.equal(draft.predecessorCommit
		, checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexDotnetResultOnlyCoreRepairFoundationPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor
	, checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent])
	.trim().split("\n").filter(Boolean), []);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...checkedRecordValueIndexDotnetResultOnlyCoreRepairAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...checkedRecordValueIndexDotnetResultOnlyCoreRepairAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show"
		, `${checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of checkedRecordValueIndexDotnetResultOnlyCoreRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor}:${inventoryPath}`]);
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
	, ".NET result-only/Core repair must refresh three live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-result-only-core-history-"
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
	for(const path of checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(
			reverseCheckedRecordValueIndexDotnetResultOnlyCoreRepairUpdate(
				source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "checked-record-value-index-dotnet-result-only-core-repair-v1"
		, predecessorCommit: checkedRecordValueIndexDotnetResultOnlyCoreRepairPredecessor
		, draftParentCommit: checkedRecordValueIndexDotnetResultOnlyCoreRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			checkedRecordValueIndexDotnetResultOnlyCoreRepairChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(
		checkedRecordValueIndexDotnetResultOnlyCoreRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} .NET result-only/Core transitions, ${additions.length} additions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
