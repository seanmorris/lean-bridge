#!/usr/bin/env node
/**
 * Record the retained-identity test correction and preserve the failed producer.
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
	ownedCheckedRetainedIdentityAddedPaths
	, ownedCheckedRetainedIdentityHistoryAddedPaths
	, ownedCheckedRetainedIdentityImplementationAddedPaths
	, ownedCheckedRetainedIdentityImplementationPaths
	, ownedCheckedRetainedIdentityChangedPaths
	, ownedCheckedRetainedIdentityCommits
	, ownedCheckedRetainedIdentityHistoryPath
	, ownedCheckedRetainedIdentityImplementation
	, ownedCheckedRetainedIdentityIntegrationBase
	, ownedCheckedRetainedIdentityIntegrationPaths
	, ownedCheckedRetainedIdentityPredecessor
	, reverseOwnedCheckedRetainedIdentityUpdate
} from "../tests/helpers/owned-checked-retained-identity-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = ownedCheckedRetainedIdentityPredecessor;
const implementation = ownedCheckedRetainedIdentityImplementation;
const integrationBase = ownedCheckedRetainedIdentityIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned checked retained identity history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, ownedCheckedRetainedIdentityCommits);
for(const [index, revision] of ownedCheckedRetainedIdentityCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedCheckedRetainedIdentityCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedRetainedIdentityImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedCheckedRetainedIdentityChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedCheckedRetainedIdentityImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRetainedIdentityHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedCheckedRetainedIdentityIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedRetainedIdentityHistoryAddedPaths])
, [...ownedCheckedRetainedIdentityHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-retained-identity-history-"
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
	assert.equal(reverseOwnedCheckedRetainedIdentityUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(git(["merge-base", implementation, integrationBase]).trim(), implementation);
	for(const path of ownedCheckedRetainedIdentityChangedPaths)
		assert.equal(git(["rev-parse", `${implementation}:${path}`])
			, git(["rev-parse", `${integrationBase}:${path}`]), path);
	const updates = [];
	for(const path of ownedCheckedRetainedIdentityChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedRetainedIdentityIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedRetainedIdentityAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(ownedCheckedRetainedIdentityImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(ownedCheckedRetainedIdentityHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-retained-identity-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: ownedCheckedRetainedIdentityCommits
			, integrationBaseCommit: integrationBase
			, scope: "Correct a test that treated a resource with an independent owning lease as expired. Preserve the retained identity and validate it after the original owner is released; allocate a different unretained resource for true expiry, invalid-input rejection and output atomicity. All other cross-session, callback, transfer, closure, shutdown, non-reuse and recovery assertions remain. Runtime, Lean code, inventory, support and old evidence are unchanged. The original WIT failure remains recorded and corrected installed acceptance is pending."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
