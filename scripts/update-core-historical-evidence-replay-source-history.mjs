#!/usr/bin/env node
/**
 * Record exact Core historical-evidence replay source transitions.
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
	coreHistoricalEvidenceReplayAddedPaths
	, coreHistoricalEvidenceReplayHistoryPath
	, coreHistoricalEvidenceReplayImplementation
	, coreHistoricalEvidenceReplayImplementationPaths
	, coreHistoricalEvidenceReplayIntegrationPaths
	, coreHistoricalEvidenceReplayPredecessor
	, reverseCoreHistoricalEvidenceReplayUpdate
} from "../tests/helpers/core-historical-evidence-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = coreHistoricalEvidenceReplayPredecessor;
const implementation = coreHistoricalEvidenceReplayImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Historical-evidence replay history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreHistoricalEvidenceReplayImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreHistoricalEvidenceReplayHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...coreHistoricalEvidenceReplayIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHistoricalEvidenceReplayAddedPaths])
, [...coreHistoricalEvidenceReplayAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-historical-evidence-replay-"
));
const lineOffsets = (source, boundaries) => {
	const offsets = new Map();
	let line = 0;
	let offset = 0;
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
	assert.equal(reverseCoreHistoricalEvidenceReplayUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of coreHistoricalEvidenceReplayImplementationPaths)
		updates.push(await gitSourceHistoryTransition(
			path, predecessor, implementation));
	const integrationUpdates = [];
	for(const path of coreHistoricalEvidenceReplayIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of coreHistoricalEvidenceReplayAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreHistoricalEvidenceReplayHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-historical-evidence-replay-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Replay immutable C++ and Rust evidence with the exact committed generators that produced it, stop Python transfer reversal at its recorded current endpoint, and retain current-generator runtime tests separately. Change no original evidence, runtime implementation, package, support observation or published claim. Final exact-head Core acceptance remains required."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
