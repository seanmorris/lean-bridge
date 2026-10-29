#!/usr/bin/env node
/**
 * Record the six unrecorded checked-JavaScript partition 11 transitions after HostNull JavaScript and this
 * layer's own central registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	hostNullPartitionGapAddedPaths
	, hostNullPartitionGapAnchorSha256
	, hostNullPartitionGapCommits
	, hostNullPartitionGapHistoryPath
	, hostNullPartitionGapIntegrationPaths
	, hostNullPartitionGapPath
	, hostNullPartitionGapPredecessor
	, hostNullPartitionGapTargetSha256
	, reverseHostNullPartitionGapUpdate
} from "../tests/helpers/host-null-partition-gap-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim(), hostNullPartitionGapPredecessor
	, "HostNull partition gap history requires its exact predecessor commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${hostNullPartitionGapHistoryPath}`], { stdio: "ignore" }).status, 0
, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...hostNullPartitionGapIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullPartitionGapAddedPaths]), [...hostNullPartitionGapAddedPaths].sort());
// Every recovered commit must be a first-parent ancestor that changed partition 11 exactly once.
const firstParent = git(["rev-list", "--first-parent", "--reverse"
	, hostNullPartitionGapPredecessor, "--", hostNullPartitionGapPath])
	.trim().split("\n");
for(const commit of hostNullPartitionGapCommits)
	assert.ok(firstParent.includes(commit), commit);

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-partition-gap-"));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map();
	let line = 0, offset = 0;
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
	assert.equal(reverseHostNullPartitionGapUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const commit of hostNullPartitionGapCommits)
		updates.push({ commit, ...await transition(hostNullPartitionGapPath
			, git(["show", `${commit}^1:${hostNullPartitionGapPath}`])
			, git(["show", `${commit}:${hostNullPartitionGapPath}`])) });
	assert.equal(updates[0].previousSha256, hostNullPartitionGapAnchorSha256);
	assert.equal(updates.at(-1).currentSha256, hostNullPartitionGapTargetSha256);
	for(let index = 1; index < updates.length; ++index)
		assert.equal(updates[index].previousSha256, updates[index - 1].currentSha256);
	const integrationUpdates = [];
	for(const path of hostNullPartitionGapIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${hostNullPartitionGapPredecessor}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of hostNullPartitionGapAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", hostNullPartitionGapPredecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(hostNullPartitionGapHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-partition-gap-source-v1"
		, predecessorCommit: hostNullPartitionGapPredecessor
		, anchorSha256: hostNullPartitionGapAnchorSha256
		, targetSha256: hostNullPartitionGapTargetSha256
		, scope: "Recover the six first-parent transitions of tests/checked-javascript-partition-11.test.mjs made by fbcaebe, d215a37, 68c4b2d, acbedcb, c890fa9 and 806b4c3 after HostNull JavaScript recorded the partition at c2d430c2, ending at the 51f2e177 state that the npm runtime default-value copy repair reverses to. The historical normalizer sits below that repair and above HostNull JavaScript so current partition bytes reverse through the npm repair, this contiguous six-transition chain, then the original HostNull JavaScript layer. This layer's own registration reverses first, newest-first. No test import, assertion, PHP claim, pin, record or product source changes."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} historical and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
