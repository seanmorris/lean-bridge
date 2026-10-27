#!/usr/bin/env node
/**
 * Record the bounded inherited checked-record history replay.
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
	coreInheritedRecordReplayBoundHistoryAdditions
	, coreInheritedRecordReplayBoundHistoryPath
	, coreInheritedRecordReplayBoundImplementation
	, coreInheritedRecordReplayBoundImplementationPaths
	, coreInheritedRecordReplayBoundIntegrationPaths
	, coreInheritedRecordReplayBoundPredecessor
	, reverseCoreInheritedRecordReplayBoundUpdate
} from "../tests/helpers/core-inherited-record-replay-bound-source-history.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = coreInheritedRecordReplayBoundPredecessor;
const implementation = coreInheritedRecordReplayBoundImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "inherited-record replay history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...coreInheritedRecordReplayBoundImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreInheritedRecordReplayBoundHistoryPath]).trim(), "");

const updates = [];
for(const path of coreInheritedRecordReplayBoundImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));

const directory = await mkdtemp(join(tmpdir(), "lean-core-inherited-replay-"));
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
	assert.equal(reverseCoreInheritedRecordReplayBoundUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const integrationUpdates = [];
	for(const path of coreInheritedRecordReplayBoundIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--"]), [...coreInheritedRecordReplayBoundIntegrationPaths].sort());
	assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
		, ...coreInheritedRecordReplayBoundHistoryAdditions])
	, [...coreInheritedRecordReplayBoundHistoryAdditions].sort());
	const historyAdditions = [];
	for(const path of coreInheritedRecordReplayBoundHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path
			, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreInheritedRecordReplayBoundHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "core-inherited-record-replay-bound-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Read inherited checked-record promotion sources from their immutable record commit instead of reconstructing the complete Fin history hub. Preserve exact source digests, reversal checks, changed-source controls, additions, and the complete Core contract."
			, historyAdditions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
