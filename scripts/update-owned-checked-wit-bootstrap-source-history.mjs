#!/usr/bin/env node
/**
 * Record the WIT disk repair and retain original failed producer bytes.
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
	ownedCheckedWitBootstrapAddedPaths
	, ownedCheckedWitBootstrapHistoryAddedPaths
	, ownedCheckedWitBootstrapImplementationAddedPaths
	, ownedCheckedWitBootstrapImplementationPaths
	, ownedCheckedWitBootstrapChangedPaths
	, ownedCheckedWitBootstrapCommits
	, ownedCheckedWitBootstrapHistoryPath
	, ownedCheckedWitBootstrapImplementation
	, ownedCheckedWitBootstrapIntegrationBase
	, ownedCheckedWitBootstrapIntegrationPaths
	, ownedCheckedWitBootstrapPredecessor
	, reverseOwnedCheckedWitBootstrapUpdate
} from "../tests/helpers/owned-checked-wit-bootstrap-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = ownedCheckedWitBootstrapPredecessor;
const implementation = ownedCheckedWitBootstrapImplementation;
const integrationBase = ownedCheckedWitBootstrapIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Owned checked WIT bootstrap history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, ownedCheckedWitBootstrapCommits);
for(const [index, revision] of ownedCheckedWitBootstrapCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : ownedCheckedWitBootstrapCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedWitBootstrapImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedCheckedWitBootstrapChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedCheckedWitBootstrapImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedWitBootstrapHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedCheckedWitBootstrapIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedWitBootstrapHistoryAddedPaths])
, [...ownedCheckedWitBootstrapHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-wit-bootstrap-history-"
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
	assert.equal(reverseOwnedCheckedWitBootstrapUpdate(
		current, update), previous, path);
	return update;
};


try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of ownedCheckedWitBootstrapChangedPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of ownedCheckedWitBootstrapIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedWitBootstrapAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(ownedCheckedWitBootstrapImplementationAddedPaths.includes(path))
			assert.deepEqual(bytes, execFileSync("git", ["show", `${implementation}:${path}`]
				, { maxBuffer: 2 * 1024 * 1024 }), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(ownedCheckedWitBootstrapHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-wit-bootstrap-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: ownedCheckedWitBootstrapCommits
			, integrationBaseCommit: integrationBase
			, scope: "Replace the owned checked-record WIT producer's Nix flake import with a verified download of the identical Wasmtime 42.0.1 archive. Preserve all SDK-file identities, installed assertions, author/API routes and original TAP names. Add offline checksum, failure, cleanup and destination controls, and a manual WIT-only probe without narrowing default push/PR matrices. Retain the failed setup's original API records, log and artifact as non-accepted evidence. An actual clean download reproduces all 38 SDK file identities; no Lean or installed consumer execution is claimed. Leave every inventory byte, runtime source and older archive unchanged. Record the remaining twelve Nix-based Wasmtime workflows for rollout after the scoped probe."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
