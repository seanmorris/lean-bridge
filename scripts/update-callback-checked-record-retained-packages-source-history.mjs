#!/usr/bin/env node
/**
 * Record the callback checked-record retained package transition.
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
	callbackCheckedRecordRetainedPackagesAddedPaths
	, callbackCheckedRecordRetainedPackagesHistoricalAdditions
	, callbackCheckedRecordRetainedPackagesHistoryPath
	, callbackCheckedRecordRetainedPackagesHistoryParent
	, callbackCheckedRecordRetainedPackagesImplementation
	, callbackCheckedRecordRetainedPackagesImplementationPaths
	, callbackCheckedRecordRetainedPackagesIntegrationPaths
	, callbackCheckedRecordRetainedPackagesModifiedPaths
	, callbackCheckedRecordRetainedPackagesPredecessor
	, reverseCallbackCheckedRecordRetainedPackagesUpdate
} from "../tests/helpers/callback-checked-record-retained-packages-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, "d37781d49535b7da9205a68377e0b331b23bc18a"
	, "Callback checked-record retained package history requires its integration staging commit after the implementation commit");
assert.equal(git(["rev-parse"
	, `${callbackCheckedRecordRetainedPackagesImplementation}^`]).trim()
, callbackCheckedRecordRetainedPackagesPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackCheckedRecordRetainedPackagesPredecessor
	, callbackCheckedRecordRetainedPackagesImplementation]).trim().split("\n").sort()
, [...callbackCheckedRecordRetainedPackagesImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only"
	, callbackCheckedRecordRetainedPackagesHistoryParent, "--"
	, callbackCheckedRecordRetainedPackagesHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-checked-record-retained-packages-history-"));
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
	assert.equal(reverseCallbackCheckedRecordRetainedPackagesUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const historicalUpdates = [];
	for(const path of callbackCheckedRecordRetainedPackagesModifiedPaths)
		historicalUpdates.push(await transitionSources(path
			, git(["show", `${callbackCheckedRecordRetainedPackagesPredecessor}:${path}`])
			, git(["show", `${callbackCheckedRecordRetainedPackagesImplementation}:${path}`])));
	const historicalAdditions = [];
	for(const path of callbackCheckedRecordRetainedPackagesHistoricalAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackCheckedRecordRetainedPackagesPredecessor, "--", path]).trim()
		, "", path);
		historicalAdditions.push({ path
			, currentSha256: sha256(git(["show"
				, `${callbackCheckedRecordRetainedPackagesImplementation}:${path}`])) });
	}
	const integrationUpdates = [];
	for(const path of callbackCheckedRecordRetainedPackagesIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${callbackCheckedRecordRetainedPackagesHistoryParent}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackCheckedRecordRetainedPackagesAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackCheckedRecordRetainedPackagesHistoryParent, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackCheckedRecordRetainedPackagesHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-checked-record-retained-packages-v1"
			, predecessorCommit: callbackCheckedRecordRetainedPackagesPredecessor
			, implementationCommit: callbackCheckedRecordRetainedPackagesImplementation
			, historyParentCommit: callbackCheckedRecordRetainedPackagesHistoryParent
			, scope: "Retain every callback checked-record route's receipt-named package set beside its hosted report before installation, install from the retained copy, verify retained bytes in the CI checkers, refuse new archives from non-retaining producers, and keep existing immutable archives replayable."
			, historicalAdditions, historicalUpdates
			, additions, integrationUpdates
		}), { flag: "w" });
	process.stdout.write(`Recorded ${historicalUpdates.length} historical and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
