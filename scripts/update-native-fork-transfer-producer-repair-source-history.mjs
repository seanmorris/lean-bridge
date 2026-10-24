#!/usr/bin/env node
/**
 * Record the explicit Native fork and transfer producer repair.
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
	nativeForkTransferProducerRepairAddedPaths
	, nativeForkTransferProducerRepairChangedPaths
	, nativeForkTransferProducerRepairHistoryPath
	, nativeForkTransferProducerRepairImplementation
	, nativeForkTransferProducerRepairForkImplementation
	, nativeForkTransferProducerRepairForkPaths
	, nativeForkTransferProducerRepairTransferImplementation
	, nativeForkTransferProducerRepairTransferPaths
	, nativeForkTransferProducerRepairIntegrationBase
	, nativeForkTransferProducerRepairIntegrationPaths
	, nativeForkTransferProducerRepairPredecessor
	, reverseNativeForkTransferProducerRepairUpdate
} from "../tests/helpers/native-fork-transfer-producer-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = nativeForkTransferProducerRepairPredecessor;
const implementation = nativeForkTransferProducerRepairImplementation;
const integrationBase = nativeForkTransferProducerRepairIntegrationBase;
assert.equal(git(["rev-parse", "HEAD"]).trim(), integrationBase
	, "Native fork and transfer producer history requires its exact integration base");
assert.equal(git(["rev-parse", `${nativeForkTransferProducerRepairImplementation}^`]).trim()
	, nativeForkTransferProducerRepairForkImplementation);
assert.equal(git(["rev-parse", `${nativeForkTransferProducerRepairImplementation}^2`]).trim()
	, nativeForkTransferProducerRepairTransferImplementation);
for(const [commit, paths] of [
	[nativeForkTransferProducerRepairForkImplementation, nativeForkTransferProducerRepairForkPaths]
	, [nativeForkTransferProducerRepairTransferImplementation, nativeForkTransferProducerRepairTransferPaths]
]) {
	assert.equal(git(["rev-parse", `${commit}^`]).trim(), nativeForkTransferProducerRepairPredecessor);
	assert.deepEqual(git(["diff", "--name-only", nativeForkTransferProducerRepairPredecessor, commit])
		.trim().split("\n").filter(Boolean).sort(), [...paths].sort());
	for(const path of paths)
		assert.equal(git(["show", `${nativeForkTransferProducerRepairImplementation}:${path}`])
			, git(["show", `${commit}:${path}`]), path);
}
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...nativeForkTransferProducerRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, nativeForkTransferProducerRepairHistoryPath]).trim(), "");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...nativeForkTransferProducerRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...nativeForkTransferProducerRepairAddedPaths])
, [...nativeForkTransferProducerRepairAddedPaths].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-native-fork-transfer-producer-repair-history-"
));
// Retain only requested hunk boundaries, not millions of per-line strings.
const lineOffsets = (source, boundaries) => {
	const result = new Map();
	let line = 0;
	let offset = 0;
	for(const boundary of [...new Set(boundaries)].sort((a, b) => a - b))
	{
		assert.ok(Number.isSafeInteger(boundary) && boundary >= 0);
		while(line < boundary)
		{
			assert.ok(offset < source.length, "Diff line exceeds source");
			const newline = source.indexOf("\n", offset);
			offset = newline === -1 ? source.length : newline + 1;
			line++;
		}
		result.set(boundary, offset);
	}
	return result;
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
		return {
			previousStart, previousEnd: previousStart + previousCount
			, currentStart, currentEnd: currentStart + currentCount
		};
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
	const update = {
		path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseNativeForkTransferProducerRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of nativeForkTransferProducerRepairChangedPaths)
	{
		const current = git(["show", `${implementation}:${path}`]);
		assert.equal(current, git(["show", `${integrationBase}:${path}`])
			, `Later work changed ${path}; record a composed transition`);
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`]), current));
	}
	const integrationUpdates = [];
	for(const path of nativeForkTransferProducerRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${integrationBase}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of nativeForkTransferProducerRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", integrationBase, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(nativeForkTransferProducerRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "native-fork-transfer-producer-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, forkImplementationCommit: nativeForkTransferProducerRepairForkImplementation
			, transferImplementationCommit: nativeForkTransferProducerRepairTransferImplementation
			, integrationBaseCommit: integrationBase
			, scope: "Verify immutable native fork and installed C transfer evidence using authenticated original producer trees, generator closures, and deferred source reads. Restore the exact historical inventories directly and retain stopped source reversals, unknown-source and forged-evidence refusals, generated caller and package digests, complete predecessor replay, and the live C-transfer CI gate. Authenticate both source commits and their unchanged merge. No inventory, runtime, workflow, or installed observation changes."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
