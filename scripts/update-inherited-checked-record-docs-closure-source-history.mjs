#!/usr/bin/env node
/**
 * Record the inherited checked-record documentation correction.
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
	inheritedCheckedRecordDocsClosureAddedPaths
	, inheritedCheckedRecordDocsClosureChangedPaths
	, inheritedCheckedRecordDocsClosureDraftParent
	, inheritedCheckedRecordDocsClosureHistoryPath
	, inheritedCheckedRecordDocsClosurePredecessor
	, reverseInheritedCheckedRecordDocsClosureUpdate
} from "../tests/helpers/inherited-checked-record-docs-closure-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, inheritedCheckedRecordDocsClosureDraftParent
	, "Inherited checked-record docs history must stay on its exact draft parent");
assert.equal(inheritedCheckedRecordDocsClosurePredecessor
	, inheritedCheckedRecordDocsClosureDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, inheritedCheckedRecordDocsClosureDraftParent, "--"
	, inheritedCheckedRecordDocsClosureHistoryPath]).trim(), ""
, "Never rewrite committed inherited checked-record docs history");
const draft = await readFile(
	inheritedCheckedRecordDocsClosureHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "inherited-checked-record-docs-closure-source-v1");
	assert.equal(draft.predecessorCommit
		, inheritedCheckedRecordDocsClosurePredecessor);
	assert.equal(draft.draftParentCommit
		, inheritedCheckedRecordDocsClosureDraftParent);
}
const inventoryPath = "docs/type-surface.v1.json";
const changedSources = inheritedCheckedRecordDocsClosureChangedPaths.filter(
	path => path !== inventoryPath
);
const modifiedPaths = git(["diff", "--name-only", "--diff-filter=M"
	, inheritedCheckedRecordDocsClosurePredecessor, "--"])
	.trim().split("\n").filter(Boolean);
assert.deepEqual(modifiedPaths.filter(path => path !== inventoryPath).sort()
	, [...changedSources].sort());
const sources = new Map();
for(const path of changedSources)
{
	const previous = git(["show"
		, `${inheritedCheckedRecordDocsClosurePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const inventoryPrevious = git(["show"
	, `${inheritedCheckedRecordDocsClosurePredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const pinUpdates = [];
let pinCount = 0;
for(const [path, source] of sources)
{
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const entry of inventory.evidence) for(const file of entry.files)
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
assert.ok(pinCount > 0
	, "Documentation closure must refresh current-source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
const inventoryOnDisk = await readFile(inventoryPath, "utf8");
assert.ok([inventoryPrevious, inventoryCurrent].includes(inventoryOnDisk)
	, "Only the exact documentation source pins may change before recording");
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});
const additions = [];
for(const path of inheritedCheckedRecordDocsClosureAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${inheritedCheckedRecordDocsClosurePredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-inherited-record-docs-history-"
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
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
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
	for(const path of inheritedCheckedRecordDocsClosureChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseInheritedCheckedRecordDocsClosureUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "inherited-checked-record-docs-closure-source-v1"
		, predecessorCommit: inheritedCheckedRecordDocsClosurePredecessor
		, draftParentCommit: inheritedCheckedRecordDocsClosureDraftParent
		, pathsSha256: sha256(JSON.stringify(
			inheritedCheckedRecordDocsClosureChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(inheritedCheckedRecordDocsClosureHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} inherited checked-record documentation transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
