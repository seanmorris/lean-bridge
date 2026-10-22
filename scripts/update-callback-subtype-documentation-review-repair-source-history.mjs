#!/usr/bin/env node
/**
 * Record the callback Subtype documentation review repair transition.
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
	callbackSubtypeDocumentationReviewRepairAddedPaths
	, callbackSubtypeDocumentationReviewRepairHistoryPath
	, callbackSubtypeDocumentationReviewRepairImplementation
	, callbackSubtypeDocumentationReviewRepairImplementationPaths
	, callbackSubtypeDocumentationReviewRepairIntegrationPaths
	, callbackSubtypeDocumentationReviewRepairModifiedPaths
	, callbackSubtypeDocumentationReviewRepairPredecessor
	, reverseCallbackSubtypeDocumentationReviewRepairUpdate
} from "../tests/helpers/callback-subtype-documentation-review-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeDocumentationReviewRepairImplementation
	, "Callback Subtype documentation review history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${callbackSubtypeDocumentationReviewRepairImplementation}^`]).trim()
, callbackSubtypeDocumentationReviewRepairPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, callbackSubtypeDocumentationReviewRepairPredecessor
	, callbackSubtypeDocumentationReviewRepairImplementation]).trim().split("\n").sort()
, [...callbackSubtypeDocumentationReviewRepairImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeDocumentationReviewRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-doc-review-history-"));
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
	assert.equal(reverseCallbackSubtypeDocumentationReviewRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeDocumentationReviewRepairModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show", `${callbackSubtypeDocumentationReviewRepairPredecessor}:${path}`])
			, git(["show", `${callbackSubtypeDocumentationReviewRepairImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackSubtypeDocumentationReviewRepairIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${callbackSubtypeDocumentationReviewRepairImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackSubtypeDocumentationReviewRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeDocumentationReviewRepairPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackSubtypeDocumentationReviewRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-subtype-documentation-review-repair-v1"
			, predecessorCommit: callbackSubtypeDocumentationReviewRepairPredecessor
			, implementationCommit: callbackSubtypeDocumentationReviewRepairImplementation
			, scope: "Preserve the complete Lean-author and hand-written consumer context while promoting the exact hosted callback Subtype boundary, including the directional support row and remaining limitations."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
