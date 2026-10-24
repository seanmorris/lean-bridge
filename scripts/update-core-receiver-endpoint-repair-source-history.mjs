#!/usr/bin/env node
/**
 * Record the explicit Core receiver endpoint repair.
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
	coreReceiverEndpointRepairAddedPaths
	, coreReceiverEndpointRepairHistoryAddedPaths
	, coreReceiverEndpointRepairImplementationAddedPaths
	, coreReceiverEndpointRepairImplementationPaths
	, coreReceiverEndpointRepairChangedPaths
	, coreReceiverEndpointRepairCommits
	, coreReceiverEndpointRepairHistoryPath
	, coreReceiverEndpointRepairImplementation
	, coreReceiverEndpointRepairIntegrationBase
	, coreReceiverEndpointRepairIntegrationPaths
	, coreReceiverEndpointRepairPredecessor
	, reverseCoreReceiverEndpointRepairUpdate
} from "../tests/helpers/core-receiver-endpoint-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = coreReceiverEndpointRepairPredecessor;
const implementation = coreReceiverEndpointRepairImplementation;
const integrationBase = coreReceiverEndpointRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Core receiver endpoint repair history requires its exact integration base");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, coreReceiverEndpointRepairCommits);
for(const [index, revision] of coreReceiverEndpointRepairCommits.entries())
	assert.equal(git(["show", "-s", "--format=%P", revision]).trim()
		, index === 0 ? predecessor : coreReceiverEndpointRepairCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreReceiverEndpointRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...coreReceiverEndpointRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...coreReceiverEndpointRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT", predecessor, implementation]), []);
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreReceiverEndpointRepairHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...coreReceiverEndpointRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreReceiverEndpointRepairHistoryAddedPaths])
, [...coreReceiverEndpointRepairHistoryAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-receiver-endpoint-repair-history-"
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
	assert.equal(reverseCoreReceiverEndpointRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	assert.equal(implementation, integrationBase);
	const updates = [];
	for(const path of coreReceiverEndpointRepairChangedPaths)
		updates.push(await transition(path, git(["show", predecessor + ":" + path])
			, git(["show", implementation + ":" + path])));
	const integrationUpdates = [];
	for(const path of coreReceiverEndpointRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of coreReceiverEndpointRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		const bytes = await readFile(path);
		if(coreReceiverEndpointRepairImplementationAddedPaths.includes(path))
			assert.equal(bytes.toString(), git(["show", `${implementation}:${path}`]), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	await writeFile(coreReceiverEndpointRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "core-receiver-endpoint-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: coreReceiverEndpointRepairCommits
			, integrationBaseCommit: integrationBase
			, scope: "Bind all nine Ruby, Rust and JavaScript receiver reconstruction, idempotence and inventory callers to their exact recorded predecessor digests. Reproduce the Ruby hash mismatch from Core run 40120957309 job 120952182546 on the original 3.6 MB snapshot, preserving the assertion and every original receipt. Verify three original inventories, strict source-pin-only changes, unknown source refusal and forged transition rejection without loading the current large inventory. Register bounded snapshot and caller tests in the recurring Core contract. Preserve all current support cells, inventory bytes, runtime and package code. Core shard 4 also received a runner shutdown; this repair does not establish a passing hosted run or cure runner loss. Final current-head Core remains required."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
