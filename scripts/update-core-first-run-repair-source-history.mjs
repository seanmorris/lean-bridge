#!/usr/bin/env node
/**
 * Record the first complete hosted Core-run repairs and refresh only the exact
 * stale or changed-source pins they close.
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
	coreFirstRunRepairAddedPaths, coreFirstRunRepairChangedPaths
	, coreFirstRunRepairDraftParent, coreFirstRunRepairFoundationPaths
	, coreFirstRunRepairHistoryPath, coreFirstRunRepairPredecessor
	, reverseCoreFirstRunRepairUpdate
} from "../tests/helpers/core-first-run-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const testProfilePath = "src/adoption/test-profiles.mjs";
const staleTestProfileSha256
	= "6c5c9687c4246163a14140e200d5d6b056c6493bb3b1a679b584576357f12c08";
const currentTestProfileSha256
	= "e579bac05a6eefd514b8375bcc7efb29c67ea93abcebf5216c06b167fcd40d8e";
const historyModifiedPaths = Object.freeze([
	"tests/component-array-contract.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
]);
const implementationPaths = coreFirstRunRepairChangedPaths.filter(path =>
	path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim(), coreFirstRunRepairDraftParent
	, "Core first-run history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), coreFirstRunRepairPredecessor
	, "Core first-run repair must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", coreFirstRunRepairDraftParent
	, "--", coreFirstRunRepairHistoryPath]).trim(), ""
, "Never rewrite committed Core first-run repair history");
const draft = await readFile(coreFirstRunRepairHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "core-first-run-repair-source-v1");
	assert.equal(draft.predecessorCommit, coreFirstRunRepairPredecessor);
	assert.equal(draft.draftParentCommit, coreFirstRunRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, coreFirstRunRepairPredecessor, coreFirstRunRepairDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [inventoryPath, ...coreFirstRunRepairFoundationPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
	, coreFirstRunRepairPredecessor, coreFirstRunRepairDraftParent])
	.trim().split("\n").filter(Boolean), []);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, "docs/evidence", "scripts", "tests"])
	.trim().split("\n").filter(path => path
		&& path !== coreFirstRunRepairHistoryPath).sort()
, [...coreFirstRunRepairAddedPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"])
	.trim().split("\n").filter(Boolean).sort()
, [...historyModifiedPaths, ...(draft ? [inventoryPath] : [])].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show", `${coreFirstRunRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of coreFirstRunRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${coreFirstRunRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${coreFirstRunRepairPredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
assert.equal(sha256(await readFile(testProfilePath))
	, currentTestProfileSha256);
let stalePinCount = 0;
for(const evidence of inventory.evidence) for(const file of evidence.files)
	if(file.path === testProfilePath
		&& file.sha256 === staleTestProfileSha256){
		file.sha256 = currentTestProfileSha256;
		stalePinCount++;
		}
assert.equal(stalePinCount, 94
	, "Core first-run repair must close all 94 stale test-profile pins");
const foundationInventory = JSON.stringify(inventory, null, 2) + "\n";
const inventoryWorktree = await readFile(inventoryPath, "utf8");
if(draft)
{
	const draftInventory = draft.updates.find(update =>
		update.path === inventoryPath);
	assert.ok(draftInventory);
	assert.equal(sha256(inventoryWorktree), draftInventory.currentSha256
		, "Draft inventory differs from its last generated repair record");
}
else assert.equal(inventoryWorktree, foundationInventory
	, "Repair commit has unrecorded inventory changes");

const pinUpdates = [{
	path: testProfilePath, previousSha256: staleTestProfileSha256
	, currentSha256: currentTestProfileSha256, count: stalePinCount
}];
let pinCount = stalePinCount;
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
assert.equal(pinCount, 207
	, "Core first-run repair must close 94 stale and 113 changed-source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-core-first-run-repair-history-"
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
	for(const path of coreFirstRunRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCoreFirstRunRepairUpdate(source.current, update)
			, source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1, milestone: "core-first-run-repair-source-v1"
		, predecessorCommit: coreFirstRunRepairPredecessor
		, draftParentCommit: coreFirstRunRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(coreFirstRunRepairChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(coreFirstRunRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} first-run transitions, ${additions.length} additions, ${stalePinCount} stale pins and ${pinCount - stalePinCount} changed-source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
