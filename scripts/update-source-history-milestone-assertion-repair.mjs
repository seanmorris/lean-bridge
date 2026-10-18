#!/usr/bin/env node
/**
 * Record the source-history milestone assertion repair and refresh only its
 * matching live source pins.
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
	reverseSourceHistoryMilestoneAssertionRepairUpdate
	, sourceHistoryMilestoneAssertionRepairAddedPaths
	, sourceHistoryMilestoneAssertionRepairChangedPaths
	, sourceHistoryMilestoneAssertionRepairDraftParent
	, sourceHistoryMilestoneAssertionRepairFoundationPaths
	, sourceHistoryMilestoneAssertionRepairHistoryPath
	, sourceHistoryMilestoneAssertionRepairPredecessor
} from "../tests/helpers/source-history-milestone-assertion-repair.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths
	= sourceHistoryMilestoneAssertionRepairChangedPaths.filter(path =>
		path !== inventoryPath);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, sourceHistoryMilestoneAssertionRepairDraftParent
	, "Milestone assertion history must stay on its exact repair commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, sourceHistoryMilestoneAssertionRepairPredecessor
	, "Milestone assertion repair must have its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, sourceHistoryMilestoneAssertionRepairDraftParent, "--"
	, sourceHistoryMilestoneAssertionRepairHistoryPath]).trim(), ""
, "Never rewrite committed milestone assertion history");
const draft = await readFile(
	sourceHistoryMilestoneAssertionRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone
		, "source-history-milestone-assertion-repair-v1");
	assert.equal(draft.predecessorCommit
		, sourceHistoryMilestoneAssertionRepairPredecessor);
	assert.equal(draft.draftParentCommit
		, sourceHistoryMilestoneAssertionRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, sourceHistoryMilestoneAssertionRepairPredecessor
	, sourceHistoryMilestoneAssertionRepairDraftParent])
	.trim().split("\n").filter(Boolean).sort()
, [...sourceHistoryMilestoneAssertionRepairFoundationPaths].sort());
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=A"
	, sourceHistoryMilestoneAssertionRepairPredecessor
	, sourceHistoryMilestoneAssertionRepairDraftParent])
	.trim().split("\n").filter(Boolean), []);
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...sourceHistoryMilestoneAssertionRepairAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...sourceHistoryMilestoneAssertionRepairAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show"
		, `${sourceHistoryMilestoneAssertionRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of sourceHistoryMilestoneAssertionRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${sourceHistoryMilestoneAssertionRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${sourceHistoryMilestoneAssertionRepairPredecessor}:${inventoryPath}`]);
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
	, "Milestone assertion repair must refresh three live source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, { previous: inventoryPrevious
	, current: inventoryCurrent });

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-source-history-assertion-repair-"
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
	for(const path of sourceHistoryMilestoneAssertionRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseSourceHistoryMilestoneAssertionRepairUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "source-history-milestone-assertion-repair-v1"
		, predecessorCommit: sourceHistoryMilestoneAssertionRepairPredecessor
		, draftParentCommit: sourceHistoryMilestoneAssertionRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			sourceHistoryMilestoneAssertionRepairChangedPaths))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(sourceHistoryMilestoneAssertionRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} milestone assertion transitions, ${additions.length} additions and ${pinCount} source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
