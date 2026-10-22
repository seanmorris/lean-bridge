#!/usr/bin/env node
/**
 * Record the managed callback Subtype consumer contract repair.
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
	callbackSubtypeManagedConsumerRepairAddedPaths
	, callbackSubtypeManagedConsumerRepairChangedPaths
	, callbackSubtypeManagedConsumerRepairHistoryPath
	, callbackSubtypeManagedConsumerRepairImplementation
	, callbackSubtypeManagedConsumerRepairImplementationPaths
	, callbackSubtypeManagedConsumerRepairPredecessor
	, reverseCallbackSubtypeManagedConsumerRepairUpdate
} from "../tests/helpers/callback-subtype-managed-consumer-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeManagedConsumerRepairImplementation
	, "managed callback Subtype repair history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${callbackSubtypeManagedConsumerRepairImplementation}^`]).trim()
, callbackSubtypeManagedConsumerRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypeManagedConsumerRepairPredecessor
	, callbackSubtypeManagedConsumerRepairImplementation]).trim().split("\n").sort()
, [...callbackSubtypeManagedConsumerRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeManagedConsumerRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-managed-subtype-consumer-history-"));
const transitionSources = async (path, previous, current) => {
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
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current), edits
	};
	assert.equal(reverseCallbackSubtypeManagedConsumerRepairUpdate(
		current, update), previous, path);
	return update;
};
const transition = async path => transitionSources(path
	, git(["show"
		, `${callbackSubtypeManagedConsumerRepairPredecessor}:${path}`])
	, await readFile(path, "utf8"));

try
{
	for(const path of callbackSubtypeManagedConsumerRepairChangedPaths)
		assert.notEqual(git(["ls-tree", "--name-only"
			, callbackSubtypeManagedConsumerRepairPredecessor, "--", path]
		).trim(), "", path);
	const updates = [];
	for(const path of callbackSubtypeManagedConsumerRepairChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of callbackSubtypeManagedConsumerRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeManagedConsumerRepairPredecessor, "--", path]
		).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackSubtypeManagedConsumerRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-subtype-managed-consumer-repair-v1"
			, predecessorCommit: callbackSubtypeManagedConsumerRepairPredecessor
			, implementationCommit: callbackSubtypeManagedConsumerRepairImplementation
			, scope: "The .NET, Java and Kotlin callback Subtype consumers now distinguish native input refusal from a refused host reply using the established managed runtime contract. Invalid recovery and returned-closure arguments require the exact managed invalid-input exception, while invalid host results retain LeanBridgeException status 1 and its constructor diagnostic. The Java fixture preserves explicit idempotent double-close coverage without triggering javac's try-with-resources lint under -Werror. Hosted installation remains the acceptance boundary."
			, additions, updates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and `
		+ `${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
