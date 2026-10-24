#!/usr/bin/env node
/**
 * Record the historical evidence replay repair and every path in the omitted
 * transfer-copy commit from exact Git blobs.
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
	ownedTransferCopyHistoricalCommit
	, ownedTransferCopyHistoricalPaths
	, ownedTransferCopyHistoricalPredecessor
	, ownedReplayHistoricalGapGroups
	, ownedTransferCopyNativeFollowupCommit
	, ownedTransferCopyNativeFollowupPaths
	, ownedTransferCopyReplayRepairAddedPaths
	, ownedTransferCopyReplayRepairHistoryPath
	, ownedTransferCopyReplayRepairImplementation
	, ownedTransferCopyReplayRepairIntegrationPaths
	, ownedTransferCopyReplayRepairModifiedPaths
	, ownedTransferCopyReplayRepairPredecessor
	, reverseOwnedTransferCopyReplayRepairUpdate
} from "../tests/helpers/owned-transfer-copy-replay-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation = ownedTransferCopyReplayRepairImplementation;
const predecessor = ownedTransferCopyReplayRepairPredecessor;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "This history requires its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${ownedTransferCopyReplayRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...ownedTransferCopyReplayRepairModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedTransferCopyReplayRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedTransferCopyReplayRepairAddedPaths])
, [...ownedTransferCopyReplayRepairAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-transfer-copy-replay-history-"
));
const transition = async (path, previous, current, commits = undefined) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
			, previousPath, currentPath]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
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
		, ...(commits ?? {})
		, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseOwnedTransferCopyReplayRepairUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedTransferCopyReplayRepairModifiedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const integrationUpdates = [];
	for(const path of ownedTransferCopyReplayRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(implementation, path), await readFile(path, "utf8")));
	const historicalTransitions = [];
	for(const group of ownedReplayHistoricalGapGroups)
	{
		for(const path of group.paths)
		{
			const previousCommit = git(["log", "-2", "--format=%H"
				, group.currentCommit, "--", path]).trim().split("\n")[1];
			assert.match(previousCommit ?? "", /^[a-f0-9]{40}$/u, path);
			historicalTransitions.push(await transition(path
				, source(previousCommit, path)
				, source(group.currentCommit, path), {
					previousCommit, currentCommit: group.currentCommit
				}
			));
		}
	}
	for(const path of ownedTransferCopyHistoricalPaths)
	{
		if(ownedTransferCopyNativeFollowupPaths.includes(path))
			historicalTransitions.push(await transition(path
				, source(ownedTransferCopyHistoricalCommit, path)
				, source(ownedTransferCopyNativeFollowupCommit, path), {
					previousCommit: ownedTransferCopyHistoricalCommit
					, currentCommit: ownedTransferCopyNativeFollowupCommit
				}
			));
		historicalTransitions.push(await transition(path
			, source(ownedTransferCopyHistoricalPredecessor, path)
			, source(ownedTransferCopyHistoricalCommit, path), {
				previousCommit: ownedTransferCopyHistoricalPredecessor
				, currentCommit: ownedTransferCopyHistoricalCommit
			}
		));
	}
	const additions = [];
	for(const path of ownedTransferCopyReplayRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedTransferCopyReplayRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-transfer-copy-replay-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, historicalPredecessorCommit: ownedTransferCopyHistoricalPredecessor
		, historicalCommit: ownedTransferCopyHistoricalCommit
		, nativeFollowupCommit: ownedTransferCopyNativeFollowupCommit
		, scope: "Authenticate frozen owned JavaScript and PHP-Wasm evidence through the complete history hub, replay byte receipts at their recorded generator epoch, and restore the omitted transfer-copy and owned-Subtype source transitions exposed by the full historical walk without rewriting evidence."
		, additions, updates, integrationUpdates, historicalTransitions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration and `
		+ `${historicalTransitions.length} omitted historical transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
