#!/usr/bin/env node
/**
 * Record the exact aggregate recursive checked-record promotion, generated
 * documentation, and refreshed source identities.
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
	recursiveCheckedRecordPromotionAddedPaths
	, recursiveCheckedRecordPromotionChangedPaths
	, recursiveCheckedRecordPromotionDraftParent
	, recursiveCheckedRecordPromotionHistoryPath
	, recursiveCheckedRecordPromotionPredecessor
	, reverseRecursiveCheckedRecordPromotionUpdate
} from "../tests/helpers/recursive-checked-record-promotion-source-history.mjs";
import {
	promoteRecursiveCheckedRecords, recursiveCheckedRecordReferences
} from "../tests/helpers/recursive-checked-record-promotion.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, recursiveCheckedRecordPromotionDraftParent
	, "Recursive promotion history must stay on its exact draft parent");
assert.equal(recursiveCheckedRecordPromotionPredecessor
	, recursiveCheckedRecordPromotionDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, recursiveCheckedRecordPromotionDraftParent, "--"
	, recursiveCheckedRecordPromotionHistoryPath]).trim(), ""
, "Never rewrite committed recursive promotion history");
const draft = await readFile(
	recursiveCheckedRecordPromotionHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "recursive-checked-record-promotion-source-v1");
	assert.equal(draft.predecessorCommit
		, recursiveCheckedRecordPromotionPredecessor);
	assert.equal(draft.draftParentCommit
		, recursiveCheckedRecordPromotionDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, recursiveCheckedRecordPromotionPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...recursiveCheckedRecordPromotionChangedPaths].sort());

const sources = new Map();
for(const path of recursiveCheckedRecordPromotionChangedPaths)
{
	if(path === inventoryPath) continue;
	const previous = git(["show"
		, `${recursiveCheckedRecordPromotionPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of recursiveCheckedRecordPromotionAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${recursiveCheckedRecordPromotionPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${recursiveCheckedRecordPromotionPredecessor}:${inventoryPath}`]);
const baseline = JSON.parse(inventoryPrevious);
const existing = JSON.parse(await readFile(inventoryPath));
assert.equal(existing.evidence.length, baseline.evidence.length + 36);
assert.equal(existing.observations.length, baseline.observations.length);
const inventory = await promoteRecursiveCheckedRecords(
	baseline, await recursiveCheckedRecordReferences()
);
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
assert.ok(pinCount > 0, "Aggregate promotion must refresh live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-recursive-record-promotion-history-"
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
	for(const path of recursiveCheckedRecordPromotionChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseRecursiveCheckedRecordPromotionUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "recursive-checked-record-promotion-source-v1"
		, predecessorCommit: recursiveCheckedRecordPromotionPredecessor
		, draftParentCommit: recursiveCheckedRecordPromotionDraftParent
		, pathsSha256: sha256(JSON.stringify(
			recursiveCheckedRecordPromotionChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(recursiveCheckedRecordPromotionHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} recursive promotion transitions, ${additions.length} additions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
