#!/usr/bin/env node
/**
 * Record the exact residual-Core ledger pointer replay repair.
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
	coreResidualLedgerPointerReplayRepairAddedPaths
	, coreResidualLedgerPointerReplayRepairChangedPaths
	, coreResidualLedgerPointerReplayRepairHistoryPath
	, coreResidualLedgerPointerReplayRepairImplementation
	, coreResidualLedgerPointerReplayRepairIntegrationPaths
	, coreResidualLedgerPointerReplayRepairPredecessor
	, reverseCoreResidualLedgerPointerReplayRepairUpdate
} from "../tests/helpers/core-residual-ledger-pointer-replay-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = coreResidualLedgerPointerReplayRepairImplementation;
const predecessor = coreResidualLedgerPointerReplayRepairPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Residual-Core ledger repair requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreResidualLedgerPointerReplayRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreResidualLedgerPointerReplayRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-residual-ledger-pointer-repair-"
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
	assert.equal(reverseCoreResidualLedgerPointerReplayRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of coreResidualLedgerPointerReplayRepairChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of coreResidualLedgerPointerReplayRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of coreResidualLedgerPointerReplayRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreResidualLedgerPointerReplayRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "core-residual-ledger-pointer-replay-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "The residual-Core source-history reader now authenticates and reverses both later pointer-only ledger layers before interpreting the original edit offsets; its own addition checks reconstruct exact milestone bytes through the shared history hub."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
