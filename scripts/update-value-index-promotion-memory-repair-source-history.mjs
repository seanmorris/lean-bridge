#!/usr/bin/env node
/**
 * Record the value-index promotion milestone and bounded-cell repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	reverseValueIndexPromotionMemoryRepairUpdate
	, valueIndexPromotionMemoryRepairAddedPaths
	, valueIndexPromotionMemoryRepairChangedPaths
	, valueIndexPromotionMemoryRepairHistoryPath
	, valueIndexPromotionMemoryRepairImplementation
	, valueIndexPromotionMemoryRepairIntegrationPaths
	, valueIndexPromotionMemoryRepairPredecessor
} from "../tests/helpers/value-index-promotion-memory-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = valueIndexPromotionMemoryRepairImplementation;
const predecessor = valueIndexPromotionMemoryRepairPredecessor;
const inventoryPath = "docs/type-surface.v1.json";
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Value-index promotion memory history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...valueIndexPromotionMemoryRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, valueIndexPromotionMemoryRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-value-index-promotion-memory-history-"
));
const diffEdits = async (previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = git(["diff", "--histogram", "--no-index", "--no-ext-diff"
			, "--no-textconv", "--no-color", "--unified=0"
			, previousPath, currentPath]);
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = lines => {
		const result = [0];
		for(const line of lines) result.push(result.at(-1) + line.length);
		return result;
	};
	const currentOffsets = offsets(currentLines);
	return [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
};
const transition = async (path, previous, current, edits) => {
	const selected = edits ?? await diffEdits(previous, current);
	assert.ok(selected.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits: selected
	};
	assert.equal(reverseValueIndexPromotionMemoryRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	const sourceChanges = new Map();
	for(const path of valueIndexPromotionMemoryRepairChangedPaths)
	{
		const previous = git(["show", `${predecessor}:${path}`]);
		const current = git(["show", `${implementation}:${path}`]);
		updates.push(await transition(path, previous, current));
		sourceChanges.set(path, {
			previousSha256: sha256(previous), currentSha256: sha256(current)
		});
	}
	const inventoryPrevious = git(["show", `${implementation}:${inventoryPath}`]);
	let inventoryCurrent = inventoryPrevious;
	const inventoryEdits = [];
	const expectedCounts = new Map([
		["src/adoption/type-surface.mjs", 38]
		, ["tests/helpers/checked-record-value-index-browser-promotion-tests.mjs", 4]
		, ["tests/type-surface.test.mjs", 35]
	]);
	const pinUpdates = [];
	for(const [path, change] of sourceChanges)
	{
		const count = inventoryCurrent.split(change.previousSha256).length - 1;
		assert.equal(count, expectedCounts.get(path), path);
		let start = 0;
		while((start = inventoryCurrent.indexOf(change.previousSha256, start)) >= 0)
		{
			inventoryEdits.push({
				start, previous: change.previousSha256
				, current: change.currentSha256
			});
			start += change.previousSha256.length;
		}
		inventoryCurrent = inventoryCurrent.replaceAll(
			change.previousSha256, change.currentSha256
		);
		pinUpdates.push({ path, ...change, count });
	}
	inventoryEdits.sort((left, right) => left.start - right.start);
	assert.equal(inventoryEdits.length, 77);
	assert.doesNotThrow(() => JSON.parse(inventoryCurrent));
	await writeFile(inventoryPath, inventoryCurrent);
	const integrationUpdates = [];
	for(const path of valueIndexPromotionMemoryRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")
			, path === inventoryPath ? inventoryEdits : undefined));
	const additions = [];
	for(const path of valueIndexPromotionMemoryRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(valueIndexPromotionMemoryRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "value-index-promotion-memory-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Historical value-index promotion tests reconstruct their authenticated milestone and expand only the exact claimed cells, preventing stale full-inventory comparisons from exhausting hosted-runner memory. The live inventory changes only 77 exact source hashes."
		, pinCount: inventoryEdits.length, pinUpdates
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration and `
		+ `${inventoryEdits.length} source-pin updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
