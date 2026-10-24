#!/usr/bin/env node
/**
 * Record the exact owned lifetime producer replay history.
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
	ownedLifetimeReplayAddedPaths
	, ownedLifetimeReplayHistoryPath
	, ownedLifetimeReplayImplementation
	, ownedLifetimeReplayImplementationAddedPaths
	, ownedLifetimeReplayImplementationPaths
	, ownedLifetimeReplayIntegrationPaths
	, ownedLifetimeReplayModifiedPaths
	, ownedLifetimeReplayPredecessor
	, reverseOwnedLifetimeReplayUpdate
} from "../tests/helpers/owned-lifetime-producer-replay-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = ownedLifetimeReplayImplementation;
const predecessor = ownedLifetimeReplayPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Owned lifetime producer replay history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedLifetimeReplayImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedLifetimeReplayHistoryPath]).trim(), "");

assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M", predecessor, implementation])
	, [...ownedLifetimeReplayModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A", predecessor, implementation])
	, [...ownedLifetimeReplayImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"])
	, [...ownedLifetimeReplayIntegrationPaths].sort()
	, "Only the recorded hub and test registration may change during integration");

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-lifetime-producer-replay-"
));
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
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const currentOffsets = [0];
	for(const line of currentLines)
		currentOffsets.push(currentOffsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentOffsets[currentStart]
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseOwnedLifetimeReplayUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedLifetimeReplayModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedLifetimeReplayIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedLifetimeReplayAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedLifetimeReplayHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-lifetime-producer-replay-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Reproduce C++ borrows, Rust receivers, JVM receiver GC and WIT receivers with their exact unchanged receipt producers and authenticated module/data closures of 70, 77, 103 and 94 files. Explicitly pin the producer Git identities of omitted Boost JSON and JVM tool-options sources. Preserve fresh JVM generator selection; authenticate deferred probe reads and archived CLI files, including sparse-checkout omissions, and reject rehashed CLI forgeries. Preserve the four original wasm32-era 64-bit snapshots using their original producer and its 38-file closure, explicitly pinning omitted SPDX data. Retain current 32-bit layout checks and live implicit/explicit 64-bit output equality. Original receipt, archive, type-inventory, execution and support claims are unchanged. Full source-history/inventory replay, longer original mutation suites and complete Core verification remain hosted gates."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
