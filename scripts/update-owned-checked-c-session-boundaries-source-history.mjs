#!/usr/bin/env node
/**
 * Record direct C/WIT session assertions and preserve original installed evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	ownedCheckedCSessionBoundariesAddedPaths
	, ownedCheckedCSessionBoundariesHistoryAddedPaths
	, ownedCheckedCSessionBoundariesImplementationAddedPaths
	, ownedCheckedCSessionBoundariesImplementationPaths
	, ownedCheckedCSessionBoundariesChangedPaths
	, ownedCheckedCSessionBoundariesCommits
	, ownedCheckedCSessionBoundariesHistoryPath
	, ownedCheckedCSessionBoundariesImplementation
	, ownedCheckedCSessionBoundariesIntegrationBase
	, ownedCheckedCSessionBoundariesIntegrationPaths
	, ownedCheckedCSessionBoundariesPredecessor
	, reverseOwnedCheckedCSessionBoundariesUpdate
} from "../tests/helpers/owned-checked-c-session-boundaries-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = ownedCheckedCSessionBoundariesPredecessor;
const implementation = ownedCheckedCSessionBoundariesImplementation;
const integrationBase = ownedCheckedCSessionBoundariesIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned checked C session boundaries history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, ownedCheckedCSessionBoundariesCommits);
for(const [index, revision] of ownedCheckedCSessionBoundariesCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedCheckedCSessionBoundariesCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedCSessionBoundariesImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedCheckedCSessionBoundariesChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedCheckedCSessionBoundariesImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedCSessionBoundariesHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedCheckedCSessionBoundariesIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedCSessionBoundariesHistoryAddedPaths])
, [...ownedCheckedCSessionBoundariesHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-c-session-boundaries-history-"
));
// Retain only requested hunk boundaries, not millions of per-line strings.
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			line++;
		}
		result.set(boundary, offset);
	}
	return result;
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
		return {
			previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount
		};
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
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseOwnedCheckedCSessionBoundariesUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(git(["merge-base", implementation, integrationBase]).trim(), implementation);
	for(const path of ownedCheckedCSessionBoundariesChangedPaths)
		assert.equal(git(["rev-parse", `${implementation}:${path}`])
			, git(["rev-parse", `${integrationBase}:${path}`]), path);
	const updates = [];
	for(const path of ownedCheckedCSessionBoundariesChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedCSessionBoundariesIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedCSessionBoundariesAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(ownedCheckedCSessionBoundariesImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(ownedCheckedCSessionBoundariesHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-c-session-boundaries-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: ownedCheckedCSessionBoundariesCommits
			, integrationBaseCommit: integrationBase
			, scope: "Add real foreign-session rejection to the full checked-record C caller, reused by WIT with independently opened Wasmtime instances. Cover both borrowed directions, a later array element, a foreign second transfer owner, callback replies before and after transfer, closure affinity, released and closed identities, independent retains and recovery. Preserve runtime, Lean selections, every result-only caller, inventory/support and original evidence. Strict generated-header checks pass; actual installed native/WIT execution, original artifacts and final matrix gates remain pending."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
