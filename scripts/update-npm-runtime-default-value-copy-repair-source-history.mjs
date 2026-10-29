#!/usr/bin/env node
/**
 * Record the removal of the stray default-value runtime copy, the HostNull history milestone reads, the pin refresh and central registration.
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
	npmRuntimeDefaultValueCopyRepairAddedPaths
	, npmRuntimeDefaultValueCopyRepairCommits
	, npmRuntimeDefaultValueCopyRepairHistoryPath
	, npmRuntimeDefaultValueCopyRepairImplementation
	, npmRuntimeDefaultValueCopyRepairImplementationPaths
	, npmRuntimeDefaultValueCopyRepairIntegrationPaths
	, npmRuntimeDefaultValueCopyRepairPredecessor
	, reverseNpmRuntimeDefaultValueCopyRepairUpdate
} from "../tests/helpers/npm-runtime-default-value-copy-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = npmRuntimeDefaultValueCopyRepairPredecessor;
const implementation = npmRuntimeDefaultValueCopyRepairImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Default-value copy repair history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, npmRuntimeDefaultValueCopyRepairCommits);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...npmRuntimeDefaultValueCopyRepairImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${npmRuntimeDefaultValueCopyRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...npmRuntimeDefaultValueCopyRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...npmRuntimeDefaultValueCopyRepairAddedPaths])
, [...npmRuntimeDefaultValueCopyRepairAddedPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-npm-runtime-default-value-copy-repair-"));
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
	assert.equal(reverseNpmRuntimeDefaultValueCopyRepairUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of npmRuntimeDefaultValueCopyRepairImplementationPaths)
		updates.push(await gitSourceHistoryTransition(path, predecessor
			, implementation, { maximumEditBytes: 16 * 1024 * 1024 }));
	const integrationUpdates = [];
	for(const path of npmRuntimeDefaultValueCopyRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of npmRuntimeDefaultValueCopyRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(npmRuntimeDefaultValueCopyRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "npm-runtime-default-value-copy-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Remove the stray default-value entry that the HostNull npm commit 5f7a6cb added to the binding-ir copy list of the shared npm runtime package, together with the three component npm package assertions that claimed an internal/binding-ir/default-value.mjs file and imports of it from the copied, callable and structured-callable runtime modules. No src/binding-ir/default-value.mjs exists at this milestone and none of those runtime modules import it, so every installed npm build failed with ENOENT. The HostNull JavaScript history test now resolves its history-added files and its integration paths through their authenticated Fin history milestones instead of the live working tree, so later newest-first layers no longer change the bytes it authenticates; every assertion, digest, order and refusal is unchanged. The 16 src/release/component-npm-package.mjs type-surface pins are refreshed to the repaired bytes; no other pin, record, support cell or product source changes. Register the transition newest-first; hosted Downstream remains the terminal acceptance gate."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
