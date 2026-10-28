#!/usr/bin/env node
/**
 * Record the exact CI-reliability source sequence and its hub integration.
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
	coreCiReliabilityAddedPaths
	, coreCiReliabilityHistoryPath
	, coreCiReliabilityImplementation
	, coreCiReliabilityImplementationCommits
	, coreCiReliabilityIntegrationPaths
	, coreCiReliabilityPredecessor
	, coreCiReliabilityTransitions
	, reverseCoreCiReliabilityUpdate
} from "../tests/helpers/core-ci-reliability-source-history.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();

assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreCiReliabilityImplementation
	, "CI-reliability history requires its exact pin-repair commit");
let parent = coreCiReliabilityPredecessor;
for(const [index, transition] of coreCiReliabilityTransitions.entries())
{
	assert.equal(transition.previousCommit, parent);
	assert.equal(transition.currentCommit
		, coreCiReliabilityImplementationCommits[index]);
	assert.equal(git(["rev-parse", `${transition.currentCommit}^`]).trim()
		, transition.previousCommit);
	assert.deepEqual(names(["diff", "--name-only"
		, transition.previousCommit, transition.currentCommit])
	, [...transition.paths].sort());
	parent = transition.currentCommit;
}

assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...coreCiReliabilityIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreCiReliabilityAddedPaths]), [...coreCiReliabilityAddedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, coreCiReliabilityHistoryPath]).trim(), "");

const updates = [];
for(const transition of coreCiReliabilityTransitions)
	for(const path of transition.paths)
		updates.push(await gitSourceHistoryTransition(
			path, transition.previousCommit, transition.currentCommit
		));

const directory = await mkdtemp(join(tmpdir(), "lean-core-ci-reliability-"));
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
const workingTreeTransition = async (path, previous, current) => {
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
	assert.equal(reverseCoreCiReliabilityUpdate(current, update), previous, path);
	return update;
};
const integrationUpdates = [];
try
{
	for(const path of coreCiReliabilityIntegrationPaths)
		integrationUpdates.push(await workingTreeTransition(path
			, git(["show", `${coreCiReliabilityImplementation}:${path}`])
			, await readFile(path, "utf8")));
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
const additions = [];
for(const path of coreCiReliabilityAddedPaths)
{
	assert.equal(git(["ls-tree", "--name-only"
		, coreCiReliabilityPredecessor, "--", path]).trim(), "", path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}

await writeFile(coreCiReliabilityHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-ci-reliability-source-v1"
	, predecessorCommit: coreCiReliabilityPredecessor
	, implementationCommits: coreCiReliabilityImplementationCommits
	, implementationCommit: coreCiReliabilityImplementation
	, scope: "Bound the signed-Nix checkout and native callback compiler downloads; serialize each Fin acceptance job behind its established sibling so exact-version caches are reused; then refresh exactly the 94 live non-evidence source pins affected by those changes. This transition changes no type-surface claim, observation, evidence inventory, support relation, or runtime contract."
	, livePinRefreshes: 94
	, additions, updates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation updates and ${integrationUpdates.length} integration updates.\n`);
