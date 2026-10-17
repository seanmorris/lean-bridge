#!/usr/bin/env node
/**
 * Record inherited checked-record .NET support without changing any earlier
 * source-history ledger.
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
	inheritedCheckedRecordDotnetAddedPaths
	, inheritedCheckedRecordDotnetChangedPaths
	, inheritedCheckedRecordDotnetDraftParent
	, inheritedCheckedRecordDotnetHistoryPath
	, inheritedCheckedRecordDotnetPredecessor
} from "../tests/helpers/inherited-checked-record-dotnet-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const sourcePaths = inheritedCheckedRecordDotnetChangedPaths
	.filter(path => path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, inheritedCheckedRecordDotnetDraftParent
	, "Inherited .NET history must stay on its exact draft parent");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor"
	, inheritedCheckedRecordDotnetPredecessor
	, inheritedCheckedRecordDotnetDraftParent]).status, 0
, "Inherited .NET predecessor must remain an ancestor");
assert.equal(git(["ls-tree", "--name-only"
	, inheritedCheckedRecordDotnetDraftParent, "--"
	, inheritedCheckedRecordDotnetHistoryPath]).trim(), ""
, "Never rewrite a committed inherited .NET ledger");
const draft = await readFile(
	inheritedCheckedRecordDotnetHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "inherited-checked-record-dotnet-source-v1");
	assert.equal(draft.predecessorCommit
		, inheritedCheckedRecordDotnetPredecessor);
	assert.equal(draft.draftParentCommit
		, inheritedCheckedRecordDotnetDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, inheritedCheckedRecordDotnetPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort(), sourcePaths);

const sources = new Map();
for(const path of sourcePaths)
{
	const previous = git(["show"
		, `${inheritedCheckedRecordDotnetPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of inheritedCheckedRecordDotnetAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${inheritedCheckedRecordDotnetPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	const current = await readFile(path);
	additions.push({ path, currentSha256: sha256(current) });
}

const inventoryPrevious = git(["show"
	, `${inheritedCheckedRecordDotnetPredecessor}:${inventoryPath}`]);
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
assert.ok(pinCount > 0, "Inherited .NET support must refresh live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-inherited-record-dotnet-history-"
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
	for(const path of inheritedCheckedRecordDotnetChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
		};
		if(path === inventoryPath) update.replacements = pinUpdates.map(pin => ({
			previous: pin.previousSha256, current: pin.currentSha256
			, count: pin.count
		}));
		else update.edits = await edits(source.previous, source.current);
		updates.push(update);
	}
	const pathsSha256 = sha256(JSON.stringify(
		inheritedCheckedRecordDotnetChangedPaths
	));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "inherited-checked-record-dotnet-source-v1"
		, predecessorCommit: inheritedCheckedRecordDotnetPredecessor
		, draftParentCommit: inheritedCheckedRecordDotnetDraftParent
		, pathsSha256, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(inheritedCheckedRecordDotnetHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transitions, ${additions.length} additions and refreshed ${pinCount} pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
