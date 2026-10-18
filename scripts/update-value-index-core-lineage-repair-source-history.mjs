#!/usr/bin/env node
/**
 * Record the value-index Core partition repair, close its two omitted
 * test-profile transitions, and refresh only matching live source pins.
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
	reverseValueIndexCoreLineageHistoricalUpdate
	, reverseValueIndexCoreLineageRepairUpdate
	, valueIndexCoreLineageRepairAddedPaths
	, valueIndexCoreLineageRepairChangedPaths
	, valueIndexCoreLineageRepairDraftParent
	, valueIndexCoreLineageRepairHistoryPath
	, valueIndexCoreLineageRepairPredecessor
} from "../tests/helpers/value-index-core-lineage-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const foundationModifiedPaths = Object.freeze([
	"tests/checked-records.test.mjs"
	, "tests/component-array-contract.test.mjs"
]);
const implementationPaths = valueIndexCoreLineageRepairChangedPaths.filter(path =>
	path !== inventoryPath);
const profilePath = "src/adoption/test-profiles.mjs";
const historicalMilestones = Object.freeze([
	{
		path: profilePath
		, previousCommit: "c1f471569d1855d990bc5e6fb94454f7620e5bab"
		, currentCommit: "fc5d255a48e863bfee9624def578b82c851d0566"
	}
	, {
		path: profilePath
		, previousCommit: "6cfd228a7ea5b0677cd5c9068203e67e5ee399d7"
		, currentCommit: "c1f471569d1855d990bc5e6fb94454f7620e5bab"
	}
]);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, valueIndexCoreLineageRepairDraftParent
	, "Value-index Core lineage history must stay on its exact foundation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, valueIndexCoreLineageRepairPredecessor
	, "Value-index Core lineage foundation must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, valueIndexCoreLineageRepairDraftParent, "--"
	, valueIndexCoreLineageRepairHistoryPath]).trim(), ""
, "Never rewrite committed value-index Core lineage history");
const draft = await readFile(valueIndexCoreLineageRepairHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "value-index-core-lineage-repair-source-v1");
	assert.equal(draft.predecessorCommit
		, valueIndexCoreLineageRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, valueIndexCoreLineageRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, valueIndexCoreLineageRepairPredecessor
	, valueIndexCoreLineageRepairDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [...foundationModifiedPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
	, valueIndexCoreLineageRepairPredecessor
	, valueIndexCoreLineageRepairDraftParent])
	.trim().split("\n").filter(Boolean), []);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...valueIndexCoreLineageRepairAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...valueIndexCoreLineageRepairAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show"
		, `${valueIndexCoreLineageRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of valueIndexCoreLineageRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${valueIndexCoreLineageRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${valueIndexCoreLineageRepairPredecessor}:${inventoryPath}`]);
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
	, "Value-index Core lineage repair must refresh exactly three live pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-value-index-core-lineage-history-"
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
	for(const path of valueIndexCoreLineageRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseValueIndexCoreLineageRepairUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const historicalTransitions = [];
	for(const item of historicalMilestones)
	{
		const previous = git(["show", `${item.previousCommit}:${item.path}`]);
		const current = git(["show", `${item.currentCommit}:${item.path}`]);
		assert.notEqual(current, previous, item.path);
		const transition = {
			...item, previousSha256: sha256(previous)
			, currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		assert.equal(reverseValueIndexCoreLineageHistoricalUpdate(
			current, transition), previous, item.path);
		historicalTransitions.push(transition);
	}
	assert.equal(historicalTransitions[0].previousSha256
		, historicalTransitions[1].currentSha256);
	assert.equal(historicalTransitions[0].currentSha256, sha256(git(["show"
		, `${valueIndexCoreLineageRepairPredecessor}:${profilePath}`])));
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "value-index-core-lineage-repair-source-v1"
		, predecessorCommit: valueIndexCoreLineageRepairPredecessor
		, draftParentCommit: valueIndexCoreLineageRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			valueIndexCoreLineageRepairChangedPaths
		))
		, pinCount, pinUpdates, additions, historicalTransitions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(valueIndexCoreLineageRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} current transitions, ${historicalTransitions.length} historical transitions, ${additions.length} additions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
