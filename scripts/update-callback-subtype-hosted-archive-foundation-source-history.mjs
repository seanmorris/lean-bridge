#!/usr/bin/env node
/**
 * Record the callback Subtype hosted-archive foundation transition.
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
	callbackSubtypeHostedArchiveFoundationAddedPaths
	, callbackSubtypeHostedArchiveFoundationHistoryPath
	, callbackSubtypeHostedArchiveFoundationImplementation
	, callbackSubtypeHostedArchiveFoundationImplementationPaths
	, callbackSubtypeHostedArchiveFoundationIntegrationPaths
	, callbackSubtypeHostedArchiveFoundationModifiedPaths
	, callbackSubtypeHostedArchiveFoundationPredecessor
	, reverseCallbackSubtypeHostedArchiveFoundationUpdate
} from "../tests/helpers/callback-subtype-hosted-archive-foundation-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeHostedArchiveFoundationImplementation
	, "Callback Subtype hosted-archive history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${callbackSubtypeHostedArchiveFoundationImplementation}^`]).trim()
, callbackSubtypeHostedArchiveFoundationPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypeHostedArchiveFoundationPredecessor
	, callbackSubtypeHostedArchiveFoundationImplementation]).trim()
	.split("\n").sort()
, [...callbackSubtypeHostedArchiveFoundationImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeHostedArchiveFoundationHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-hosted-archive-history-"));
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
	assert.equal(
		reverseCallbackSubtypeHostedArchiveFoundationUpdate(current, update)
		, previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeHostedArchiveFoundationModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show"
				, `${callbackSubtypeHostedArchiveFoundationPredecessor}:${path}`])
			, git(["show"
				, `${callbackSubtypeHostedArchiveFoundationImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackSubtypeHostedArchiveFoundationIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show"
				, `${callbackSubtypeHostedArchiveFoundationImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackSubtypeHostedArchiveFoundationAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeHostedArchiveFoundationPredecessor
			, "--", path]).trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(
		callbackSubtypeHostedArchiveFoundationHistoryPath, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-subtype-hosted-archive-foundation-v1"
			, predecessorCommit:
				callbackSubtypeHostedArchiveFoundationPredecessor
			, implementationCommit:
				callbackSubtypeHostedArchiveFoundationImplementation
			, scope: "Callback Subtype hosted evidence can independently replay all eight producer artifacts, including a reusable exact verifier for the four managed-host lanes and the exact producer, checker, consumer and archiver source closures."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
