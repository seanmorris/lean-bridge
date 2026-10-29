#!/usr/bin/env node
/**
 * Record the three unrecorded type-surface transitions on the combined HostNull lineage and this layer's own
 * central registration.
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
	authenticateSourceHistoryReverse, gitSourceBytes, gitSourceHistoryTransition
} from "../tests/helpers/source-history-stream.mjs";
import {
	hostNullTypeSurfaceLineageAddedPaths
	, hostNullTypeSurfaceLineageAnchorSha256
	, hostNullTypeSurfaceLineageCommits
	, hostNullTypeSurfaceLineageHistoryPath
	, hostNullTypeSurfaceLineageIntegrationPaths
	, hostNullTypeSurfaceLineagePath
	, hostNullTypeSurfaceLineagePinCounts
	, hostNullTypeSurfaceLineagePredecessor
	, hostNullTypeSurfaceLineageTargetSha256
	, reverseHostNullTypeSurfaceLineageUpdate
} from "../tests/helpers/host-null-type-surface-lineage-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.equal(git(["rev-parse", "HEAD"]).trim(), hostNullTypeSurfaceLineagePredecessor
	, "HostNull type-surface lineage history requires its exact predecessor commit");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${hostNullTypeSurfaceLineageHistoryPath}`], { stdio: "ignore" }).status, 0
, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...hostNullTypeSurfaceLineageIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullTypeSurfaceLineageAddedPaths]), [...hostNullTypeSurfaceLineageAddedPaths].sort());
// Every recovered commit must be a first-parent ancestor that changed type-surface.
const firstParent = git(["rev-list", "--first-parent", "--reverse"
	, hostNullTypeSurfaceLineagePredecessor, "--", hostNullTypeSurfaceLineagePath])
	.trim().split("\n");
for(const commit of hostNullTypeSurfaceLineageCommits)
	assert.ok(firstParent.includes(commit), commit);

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-type-surface-lineage-"));
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
	assert.equal(reverseHostNullTypeSurfaceLineageUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const commit of hostNullTypeSurfaceLineageCommits)
	{
		const parent = git(["rev-parse", `${commit}^1`]).trim();
		const update = await gitSourceHistoryTransition(hostNullTypeSurfaceLineagePath
			, parent, commit, { maximumEditBytes: 16 * 1024 * 1024 });
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(commit
			, hostNullTypeSurfaceLineagePath), update), true, commit);
		updates.push({ commit, ...update });
	}
	assert.equal(updates[0].previousSha256, hostNullTypeSurfaceLineageAnchorSha256);
	assert.equal(updates.at(-1).currentSha256, hostNullTypeSurfaceLineageTargetSha256);
	for(let index = 1; index < updates.length; ++index)
		assert.equal(updates[index].previousSha256, updates[index - 1].currentSha256);
	const digests = /[0-9a-f]{64}/gu;
	for(const [index, update] of updates.entries())
	{
		let pins = 0;
		for(const edit of update.edits)
		{
			assert.equal(edit.current.replace(digests, ""), edit.previous.replace(digests, ""));
			pins += edit.current.match(digests).length;
		}
		assert.equal(pins, hostNullTypeSurfaceLineagePinCounts[index], update.commit);
	}
	const integrationUpdates = [];
	for(const path of hostNullTypeSurfaceLineageIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${hostNullTypeSurfaceLineagePredecessor}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of hostNullTypeSurfaceLineageAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", hostNullTypeSurfaceLineagePredecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(hostNullTypeSurfaceLineageHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-type-surface-lineage-source-v1"
		, predecessorCommit: hostNullTypeSurfaceLineagePredecessor
		, anchorSha256: hostNullTypeSurfaceLineageAnchorSha256
		, targetSha256: hostNullTypeSurfaceLineageTargetSha256
		, scope: "Recover the three first-parent docs/type-surface.v1.json transitions on the combined HostNull lineage that no history layer reverses: d68fd8d refreshes 244 managed source pins, 8577048 applies the 16 npm runtime default-value copy repair pins on those managed bytes, and 6cdc7a5 refreshes 579 downstream source pins. The committed npm-runtime-default-value-copy-repair record and helper are retained byte-for-byte; they authenticate the same 16 pins on the pre-managed bytes of the uncombined lineage, which no longer match the combined type-surface. The historical normalizer runs after the npm repair so current type-surface bytes reverse through the downstream pins, the npm 16-pin transition and the managed pins to the 61baaf89 state that HostNull JavaScript records. This layer's own registration reverses first, newest-first. Every edit is digest-only; no pin, record, support claim or product source changes."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} historical and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
