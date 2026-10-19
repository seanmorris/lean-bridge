#!/usr/bin/env node
/**
 * Record the second hosted Core residual repairs and refresh the affected live
 * source pins from the immutable 02f3c3c predecessor.
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
	coreSecondRunResidualRepairAddedPaths
	, coreSecondRunResidualRepairChangedPaths
	, coreSecondRunResidualRepairHistoryPath
	, coreSecondRunResidualRepairPredecessor
	, reverseCoreSecondRunResidualRepairUpdate
} from "../tests/helpers/core-second-run-residual-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const implementationPaths = coreSecondRunResidualRepairChangedPaths.filter(
	path => path !== inventoryPath
);
const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreSecondRunResidualRepairPredecessor
	, "Core residual repair must stay on its exact predecessor");
assert.equal(git(["ls-tree", "--name-only"
	, coreSecondRunResidualRepairPredecessor, "--"
	, coreSecondRunResidualRepairHistoryPath]).trim(), ""
, "Never rewrite committed Core residual repair history");
const draft = await readFile(coreSecondRunResidualRepairHistoryPath, "utf8")
	.then(JSON.parse).catch(error => {
		if(error.code === "ENOENT") return null;
		throw error;
	});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "core-second-run-residual-repair-v1");
	assert.equal(draft.predecessorCommit
		, coreSecondRunResidualRepairPredecessor);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"])
	.trim().split("\n").filter(Boolean).sort()
, [...implementationPaths, ...(draft ? [inventoryPath] : [])].sort());
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, "docs/evidence", "scripts", "tests"])
	.trim().split("\n").filter(path => path
		&& path !== coreSecondRunResidualRepairHistoryPath).sort()
, [...coreSecondRunResidualRepairAddedPaths].sort());

const sources = new Map();
for(const path of implementationPaths)
{
	const previous = git(["show"
		, `${coreSecondRunResidualRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of coreSecondRunResidualRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${coreSecondRunResidualRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const inventoryPrevious = git(["show"
	, `${coreSecondRunResidualRepairPredecessor}:${inventoryPath}`]);
const inventory = JSON.parse(inventoryPrevious);
const inventoryWorktree = await readFile(inventoryPath, "utf8");
if(draft)
{
	const draftInventory = draft.updates.find(update =>
		update.path === inventoryPath);
	assert.ok(draftInventory);
	assert.equal(sha256(inventoryWorktree), draftInventory.currentSha256
		, "Draft inventory differs from its last generated repair record");
}
else assert.equal(inventoryWorktree, inventoryPrevious
	, "Residual repair worktree has unrecorded inventory changes");

const pinUpdates = [];
let pinCount = 0;
for(const path of implementationPaths)
{
	const source = sources.get(path);
	const previousSha256 = sha256(source.previous);
	const currentSha256 = sha256(source.current);
	let count = 0;
	for(const evidence of inventory.evidence) for(const file of evidence.files)
		if(file.path === path)
		{
			assert.equal(file.sha256, previousSha256
				, `${path}: predecessor inventory pin`);
			file.sha256 = currentSha256;
			count++;
		}
	if(count)
	{
		pinCount += count;
		pinUpdates.push({ path, previousSha256, currentSha256, count });
	}
}
assert.ok(pinCount > 0, "Core residual repair must refresh source pins");
const inventoryCurrent = JSON.stringify(inventory, null, 2) + "\n";
sources.set(inventoryPath, {
	previous: inventoryPrevious, current: inventoryCurrent
});

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-core-second-run-residual-repair-"
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
	for(const path of coreSecondRunResidualRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseCoreSecondRunResidualRepairUpdate(
			source.current, update), source.previous, path);
		updates.push(update);
	}
	const record = JSON.stringify({
		schemaVersion: 1, milestone: "core-second-run-residual-repair-v1"
		, predecessorCommit: coreSecondRunResidualRepairPredecessor
		, pathsSha256: sha256(JSON.stringify(
			coreSecondRunResidualRepairChangedPaths
		))
		, pinCount, pinUpdates, additions, updates
	}, null, 2) + "\n";
	await writeFile(inventoryPath, inventoryCurrent);
	await writeFile(coreSecondRunResidualRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} residual transitions, ${additions.length} additions and ${pinCount} refreshed pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
