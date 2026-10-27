#!/usr/bin/env node
/**
 * Record the bounded recursive-callable evidence replay.
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
	coreRecursiveCallableReplayBoundHistoryAdditions
	, coreRecursiveCallableReplayBoundHistoryPath
	, coreRecursiveCallableReplayBoundImplementation
	, coreRecursiveCallableReplayBoundImplementationPaths
	, coreRecursiveCallableReplayBoundIntegrationPaths
	, coreRecursiveCallableReplayBoundPredecessor
	, reverseCoreRecursiveCallableReplayBoundUpdate
} from "../tests/helpers/core-recursive-callable-replay-bound-source-history.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = coreRecursiveCallableReplayBoundPredecessor;
const implementation = coreRecursiveCallableReplayBoundImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "recursive-callable history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...coreRecursiveCallableReplayBoundImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreRecursiveCallableReplayBoundHistoryPath]).trim(), "");

const updates = [];
for(const path of coreRecursiveCallableReplayBoundImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));

const directory = await mkdtemp(join(tmpdir(), "lean-core-recursive-replay-"));
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
	assert.equal(reverseCoreRecursiveCallableReplayBoundUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const integrationUpdates = [];
	for(const path of coreRecursiveCallableReplayBoundIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--"]), [...coreRecursiveCallableReplayBoundIntegrationPaths].sort());
	assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
		, ...coreRecursiveCallableReplayBoundHistoryAdditions])
	, [...coreRecursiveCallableReplayBoundHistoryAdditions].sort());
	const historyAdditions = [];
	for(const path of coreRecursiveCallableReplayBoundHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path
			, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreRecursiveCallableReplayBoundHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "core-recursive-callable-replay-bound-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Authenticate the recursive-callable and structured-callable history chain from each immutable producer tree instead of replaying the 98 MiB live type surface through every later milestone. Validate predecessor gates before allocating current milestone inventories; bind the WIT composition boundary directly to its producer; retain exact mutation refusal, reversible transitions, source identities, inventory classification and the complete Core contract."
			, historyAdditions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
