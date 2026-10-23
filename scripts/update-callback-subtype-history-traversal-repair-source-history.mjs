#!/usr/bin/env node
/**
 * Record the exact callback-Subtype history traversal repair.
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
	callbackSubtypeHistoryTraversalRepairAddedPaths
	, callbackSubtypeHistoryTraversalRepairHistoryPath
	, callbackSubtypeHistoryTraversalRepairImplementation
	, callbackSubtypeHistoryTraversalRepairImplementationPaths
	, callbackSubtypeHistoryTraversalRepairIntegrationPaths
	, callbackSubtypeHistoryTraversalRepairPredecessor
	, reverseCallbackSubtypeHistoryTraversalRepairUpdate
} from "../tests/helpers/callback-subtype-history-traversal-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeHistoryTraversalRepairImplementation
	, "Callback Subtype traversal history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, callbackSubtypeHistoryTraversalRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypeHistoryTraversalRepairPredecessor
	, callbackSubtypeHistoryTraversalRepairImplementation]).trim()
	.split("\n").sort()
, [...callbackSubtypeHistoryTraversalRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeHistoryTraversalRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(tmpdir()
	, "lean-callback-subtype-traversal-history-"));
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
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseCallbackSubtypeHistoryTraversalRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeHistoryTraversalRepairImplementationPaths)
		updates.push(await transition(path
			, git(["show"
				, `${callbackSubtypeHistoryTraversalRepairPredecessor}:${path}`])
			, git(["show"
				, `${callbackSubtypeHistoryTraversalRepairImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackSubtypeHistoryTraversalRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show"
				, `${callbackSubtypeHistoryTraversalRepairImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackSubtypeHistoryTraversalRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeHistoryTraversalRepairPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackSubtypeHistoryTraversalRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-subtype-history-traversal-repair-v1"
			, predecessorCommit: callbackSubtypeHistoryTraversalRepairPredecessor
			, implementationCommit:
				callbackSubtypeHistoryTraversalRepairImplementation
			, scope: "Let the callback-Subtype promotion layer reverse its own exact transition before the history hub continues toward older requested milestones."
			, updates, additions, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
