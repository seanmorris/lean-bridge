#!/usr/bin/env node
/**
 * Record the local inherited checked-record lane-memory integration join.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	inheritedCheckedRecordLaneMemoryLocalJoinChangedPaths
	, inheritedCheckedRecordLaneMemoryLocalJoinCommits
	, inheritedCheckedRecordLaneMemoryLocalJoinHistoryAddedPaths
	, inheritedCheckedRecordLaneMemoryLocalJoinHistoryPath
	, inheritedCheckedRecordLaneMemoryLocalJoinImplementation
	, inheritedCheckedRecordLaneMemoryLocalJoinImplementationAddedPaths
	, inheritedCheckedRecordLaneMemoryLocalJoinPredecessor
	, reverseInheritedCheckedRecordLaneMemoryLocalJoinUpdate
} from "../tests/helpers/inherited-checked-record-lane-memory-local-join-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = inheritedCheckedRecordLaneMemoryLocalJoinPredecessor;
const implementation = inheritedCheckedRecordLaneMemoryLocalJoinImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "lane-memory local-join history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, inheritedCheckedRecordLaneMemoryLocalJoinCommits);
for(const [index, revision] of
	inheritedCheckedRecordLaneMemoryLocalJoinCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor
			: inheritedCheckedRecordLaneMemoryLocalJoinCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${inheritedCheckedRecordLaneMemoryLocalJoinHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...inheritedCheckedRecordLaneMemoryLocalJoinChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...inheritedCheckedRecordLaneMemoryLocalJoinImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...inheritedCheckedRecordLaneMemoryLocalJoinChangedPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...inheritedCheckedRecordLaneMemoryLocalJoinHistoryAddedPaths])
, [...inheritedCheckedRecordLaneMemoryLocalJoinHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-lane-memory-local-join-"));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		while(line < boundary)
		{
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			++line;
		}
		offsets.set(boundary, offset);
	}
	return offsets;
};
const transition = async (path, previous, current) => {
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
	const hunks = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return { previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount };
	});
	const previousOffsets = lineOffsets(previous, hunks.flatMap(hunk =>
		[hunk.previousStart, hunk.previousEnd]));
	const currentOffsets = lineOffsets(current, hunks.flatMap(hunk =>
		[hunk.currentStart, hunk.currentEnd]));
	const edits = hunks.map(hunk => ({
		start: currentOffsets.get(hunk.currentStart)
		, previous: previous.slice(previousOffsets.get(hunk.previousStart)
			, previousOffsets.get(hunk.previousEnd))
		, current: current.slice(currentOffsets.get(hunk.currentStart)
			, currentOffsets.get(hunk.currentEnd))
	}));
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseInheritedCheckedRecordLaneMemoryLocalJoinUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of inheritedCheckedRecordLaneMemoryLocalJoinChangedPaths)
		updates.push(await gitSourceHistoryTransition(
			path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of inheritedCheckedRecordLaneMemoryLocalJoinChangedPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	const implementationAddedPaths
		= inheritedCheckedRecordLaneMemoryLocalJoinImplementationAddedPaths;
	for(const path of implementationAddedPaths)
	{
		const bytes = await readFile(path);
		assert.equal(bytes.toString("utf8")
			, git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	const historyAddedPaths
		= inheritedCheckedRecordLaneMemoryLocalJoinHistoryAddedPaths;
	for(const path of historyAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(inheritedCheckedRecordLaneMemoryLocalJoinHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "inherited-checked-record-lane-memory-local-join-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits:
				inheritedCheckedRecordLaneMemoryLocalJoinCommits
			, scope: "Join the authenticated inherited checked-record lane-memory integration to the independently authenticated Perl milestone-read and Ruby predecessor-stop layers on the actual pushed branch. Reverse the local hub and partition transitions newest-first while retaining Claude's original integration record and immutable commit identities. No runtime, package, type-surface, observation or support claim changes. Final exact-head Core acceptance remains required."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} merged and `
		+ `${integrationUpdates.length} join updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
