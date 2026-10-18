#!/usr/bin/env node
/**
 * Record the exact downstream Fin CI repair and historical reachability fixes.
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
	downstreamFinCiRepairAddedPaths
	, downstreamFinCiRepairChangedPaths
	, downstreamFinCiRepairDraftParent
	, downstreamFinCiRepairHistoryPath
	, downstreamFinCiRepairPredecessor
	, downstreamFinCiRepairPriorPinRepairs
	, reverseDownstreamFinCiRepairUpdate
} from "../tests/helpers/downstream-fin-ci-repair-source-history.mjs";

const git = args => execFileSync("git", args, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, downstreamFinCiRepairDraftParent
	, "Downstream Fin CI repair must stay on its exact draft parent");
assert.equal(downstreamFinCiRepairPredecessor
	, downstreamFinCiRepairDraftParent);
assert.equal(git(["ls-tree", "--name-only"
	, downstreamFinCiRepairDraftParent, "--"
	, downstreamFinCiRepairHistoryPath]).trim(), ""
, "Never rewrite committed downstream Fin CI repair evidence");
const draft = await readFile(
	downstreamFinCiRepairHistoryPath, "utf8"
).then(JSON.parse).catch(error => {
	if(error.code === "ENOENT") return null;
	throw error;
});
if(draft)
{
	assert.equal(draft.schemaVersion, 1);
	assert.equal(draft.milestone, "downstream-fin-ci-repair-source-v1");
	assert.equal(draft.predecessorCommit, downstreamFinCiRepairPredecessor);
	assert.equal(draft.draftParentCommit, downstreamFinCiRepairDraftParent);
}
assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, downstreamFinCiRepairPredecessor, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [...downstreamFinCiRepairChangedPaths].sort());

const sources = new Map();
for(const path of downstreamFinCiRepairChangedPaths)
{
	const previous = git(["show"
		, `${downstreamFinCiRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sources.set(path, { previous, current });
}
const additions = [];
for(const path of downstreamFinCiRepairAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${downstreamFinCiRepairPredecessor}:${path}`]
	, { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-downstream-fin-ci-repair-"
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
	for(const path of downstreamFinCiRepairChangedPaths)
	{
		const source = sources.get(path);
		const update = {
			path, previousSha256: sha256(source.previous)
			, currentSha256: sha256(source.current)
			, edits: await edits(source.previous, source.current)
		};
		assert.equal(reverseDownstreamFinCiRepairUpdate(
			source.current, update), source.previous);
		updates.push(update);
	}
	const byPath = new Map(updates.map(update => [update.path, update]));
	for(const repair of downstreamFinCiRepairPriorPinRepairs)
	{
		assert.ok(!byPath.has(repair.path));
		assert.equal(sha256(await readFile(repair.path)), repair.currentSha256);
		byPath.set(repair.path, repair);
	}
	const inventoryPath = "docs/type-surface.v1.json";
	const previousInventory = JSON.parse(sources.get(inventoryPath).previous);
	const currentInventory = JSON.parse(sources.get(inventoryPath).current);
	assert.deepEqual(currentInventory.evidence.map(item => item.id)
		, previousInventory.evidence.map(item => item.id));
	const pinCounts = new Map();
	for(const [index, previous] of previousInventory.evidence.entries())
	{
		const current = currentInventory.evidence[index];
		assert.equal(current.id, previous.id);
		assert.deepEqual({ ...current, files: undefined }
			, { ...previous, files: undefined }, current.id);
		assert.equal(current.files.length, previous.files.length, current.id);
		for(const [position, previousFile] of previous.files.entries())
		{
			const currentFile = current.files[position];
			assert.equal(currentFile.path, previousFile.path, current.id);
			if(currentFile.sha256 === previousFile.sha256) continue;
			const update = byPath.get(currentFile.path);
			assert.ok(update, currentFile.path);
			assert.equal(previousFile.sha256, update.previousSha256);
			assert.equal(currentFile.sha256, update.currentSha256);
			pinCounts.set(currentFile.path
				, (pinCounts.get(currentFile.path) ?? 0) + 1);
		}
	}
	const pinUpdates = [...pinCounts].map(([path, count]) => ({
		path
		, previousSha256: byPath.get(path).previousSha256
		, currentSha256: byPath.get(path).currentSha256
		, count
	}));
	const pinCount = pinUpdates.reduce((total, item) => total + item.count, 0);
	assert.equal(pinCount, 141);

	const historicalTransitions = [];
	for(const commit of ["3546146", "41f0469"])
	{
		const full = git(["rev-parse", commit]).trim();
		const predecessorCommit = git(["rev-parse", `${full}^`]).trim();
		const path = ".gitattributes";
		const previous = git(["show", `${predecessorCommit}:${path}`]);
		const current = git(["show", `${full}:${path}`]);
		const update = {
			path, previousSha256: sha256(previous)
			, currentSha256: sha256(current)
			, edits: await edits(previous, current)
		};
		const reversed = [...update.edits].reverse().reduce((source, edit) => {
			assert.equal(source.slice(edit.start
				, edit.start + edit.current.length), edit.current);
			return source.slice(0, edit.start) + edit.previous
				+ source.slice(edit.start + edit.current.length);
		}, current);
		assert.equal(reversed, previous);
		historicalTransitions.push({
			commit: full, predecessorCommit, updates: [update]
		});
	}
	const record = JSON.stringify({
		schemaVersion: 1
		, milestone: "downstream-fin-ci-repair-source-v1"
		, predecessorCommit: downstreamFinCiRepairPredecessor
		, draftParentCommit: downstreamFinCiRepairDraftParent
		, pathsSha256: sha256(JSON.stringify(
			downstreamFinCiRepairChangedPaths))
		, pinCount, pinUpdates, historicalTransitions, additions, updates
	}, null, 2) + "\n";
	await writeFile(downstreamFinCiRepairHistoryPath, record
		, draft ? undefined : { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} downstream CI transitions, ${pinCount} validated pins, ${historicalTransitions.length} historical transitions and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
