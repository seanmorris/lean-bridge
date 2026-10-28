#!/usr/bin/env node
/**
 * Record the Core memory bound on the JVM and .NET process replay chain and
 * this layer's added files from exact Git blobs. Hub integration is recorded
 * separately by the integrating seal.
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
	replayChainMemoryChangedPaths
	, replayChainMemoryCommits
	, replayChainMemoryHistoryAddedPaths
	, replayChainMemoryHistoryPath
	, replayChainMemoryImplementation
	, replayChainMemoryImplementationAddedPaths
	, replayChainMemoryPredecessor
	, reverseReplayChainMemoryUpdate
} from "../tests/helpers/replay-chain-memory-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = replayChainMemoryPredecessor;
const implementation = replayChainMemoryImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), replayChainMemoryCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of replayChainMemoryCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : replayChainMemoryCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${replayChainMemoryHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...replayChainMemoryChangedPaths
		, ...replayChainMemoryImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...replayChainMemoryChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...replayChainMemoryImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...replayChainMemoryHistoryAddedPaths])
, [...replayChainMemoryHistoryAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-replay-chain-memory-"));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--unified=0", previousPath, currentPath]
			, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	const update = {
		path
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseReplayChainMemoryUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of replayChainMemoryChangedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const additions = [];
	for(const path of replayChainMemoryImplementationAddedPaths)
	{
		const bytes = await readFile(path);
		assert.equal(bytes.toString("utf8"), source(implementation, path), path);
		additions.push({ path, currentSha256: sha256(bytes) });
	}
	for(const path of replayChainMemoryHistoryAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(replayChainMemoryHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "replay-chain-memory-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, implementationCommits: replayChainMemoryCommits
		, scope: "Bound the memory of the owned JVM package, managed CI isolation, native fork and .NET process verifiers: each predecessor receipt stays pinned by exact path and SHA-256 and is verified by its own registered evidence test instead of being replayed in-process, the producer-era .NET process replay runs only in the native fork evidence test, and the .NET process, managed CI and JVM package verifiers reuse the inventories their source loops already authenticated and read only the IR schema and consumer contracts. No evidence, observation, receipt or support claim changes. Hub and registration integration are recorded by the integrating seal."
		, additions, updates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
