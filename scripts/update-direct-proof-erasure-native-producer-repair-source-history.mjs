#!/usr/bin/env node
/**
 * Record the hosted native proof producer repair and newest-first registration.
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
	directProofErasureNativeProducerRepairAddedPaths
	, directProofErasureNativeProducerRepairCommits
	, directProofErasureNativeProducerRepairHistoryPath
	, directProofErasureNativeProducerRepairImplementation
	, directProofErasureNativeProducerRepairImplementationPaths
	, directProofErasureNativeProducerRepairIntegrationPaths
	, directProofErasureNativeProducerRepairPredecessor
	, reverseDirectProofErasureNativeProducerRepairUpdate
} from "../tests/helpers/direct-proof-erasure-native-producer-repair-source-history.mjs";

assert.deepEqual(process.argv.slice(2), [], "This history writer takes no arguments");
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = directProofErasureNativeProducerRepairPredecessor;
const implementation = directProofErasureNativeProducerRepairImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Native producer repair history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, directProofErasureNativeProducerRepairCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...directProofErasureNativeProducerRepairImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${directProofErasureNativeProducerRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...directProofErasureNativeProducerRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureNativeProducerRepairAddedPaths])
, [...directProofErasureNativeProducerRepairAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-direct-proof-native-producer-history-"));
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
	assert.equal(reverseDirectProofErasureNativeProducerRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of directProofErasureNativeProducerRepairImplementationPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor
			, implementation));
	const integrationUpdates = [];
	for(const path of directProofErasureNativeProducerRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of directProofErasureNativeProducerRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(directProofErasureNativeProducerRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-native-producer-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Repair the hosted native proof producer without weakening its contract: give generator-owned C locals a namespace disjoint from admitted Lean parameter names, replay the Fin callback diagnostic against its exact implementation commit, free irrelevant hosted toolchains before the evidence checkout, and register every transition newest-first. The complete downstream matrix remains the terminal acceptance gate."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
