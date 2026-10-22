#!/usr/bin/env node
/**
 * Record the callback Subtype retained package transition.
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
	callbackSubtypeRetainedPackagesAddedPaths
	, callbackSubtypeRetainedPackagesHistoryPath
	, callbackSubtypeRetainedPackagesImplementation
	, callbackSubtypeRetainedPackagesImplementationPaths
	, callbackSubtypeRetainedPackagesIntegrationPaths
	, callbackSubtypeRetainedPackagesModifiedPaths
	, callbackSubtypeRetainedPackagesPredecessor
	, reverseCallbackSubtypeRetainedPackagesUpdate
} from "../tests/helpers/callback-subtype-retained-packages-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeRetainedPackagesImplementation
	, "Callback Subtype retained package history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${callbackSubtypeRetainedPackagesImplementation}^`]).trim()
, callbackSubtypeRetainedPackagesPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypeRetainedPackagesPredecessor
	, callbackSubtypeRetainedPackagesImplementation]).trim().split("\n").sort()
, [...callbackSubtypeRetainedPackagesImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeRetainedPackagesHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-retained-packages-history-"));
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
	assert.equal(reverseCallbackSubtypeRetainedPackagesUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeRetainedPackagesModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show", `${callbackSubtypeRetainedPackagesPredecessor}:${path}`])
			, git(["show", `${callbackSubtypeRetainedPackagesImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackSubtypeRetainedPackagesIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${callbackSubtypeRetainedPackagesImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackSubtypeRetainedPackagesAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeRetainedPackagesPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackSubtypeRetainedPackagesHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-subtype-retained-packages-v1"
			, predecessorCommit: callbackSubtypeRetainedPackagesPredecessor
			, implementationCommit: callbackSubtypeRetainedPackagesImplementation
			, scope: "Retain every callback Subtype route's receipt-named package set beside its hosted report before installation, install from the retained copy, and verify the retained bytes in the CI checkers, hosted archiver and hosted evidence replay."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
