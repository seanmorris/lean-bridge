#!/usr/bin/env node
/**
 * Record the exact owned JavaScript transfer producer-replay repair.
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
	ownedJavaScriptTransferProducerReplayRepairAddedPaths
	, ownedJavaScriptTransferProducerReplayRepairHistoryPath
	, ownedJavaScriptTransferProducerReplayRepairImplementation
	, ownedJavaScriptTransferProducerReplayRepairImplementationPaths
	, ownedJavaScriptTransferProducerReplayRepairIntegrationPaths
	, ownedJavaScriptTransferProducerReplayRepairModifiedPaths
	, ownedJavaScriptTransferProducerReplayRepairPredecessor
	, reverseOwnedJavaScriptTransferProducerReplayRepairUpdate
} from "../tests/helpers/owned-javascript-transfer-producer-replay-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = ownedJavaScriptTransferProducerReplayRepairImplementation;
const predecessor = ownedJavaScriptTransferProducerReplayRepairPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Owned JavaScript transfer producer replay repair requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedJavaScriptTransferProducerReplayRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedJavaScriptTransferProducerReplayRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-javascript-transfer-producer-replay-repair-"
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
	assert.equal(reverseOwnedJavaScriptTransferProducerReplayRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedJavaScriptTransferProducerReplayRepairModifiedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedJavaScriptTransferProducerReplayRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedJavaScriptTransferProducerReplayRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedJavaScriptTransferProducerReplayRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-javascript-transfer-producer-replay-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "The frozen owned JavaScript transfer evidence is replayed with the exact producer's complete static module and source closure, including historical proof-of-concept descriptors, rather than regenerating historical observations with current compiler semantics."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
