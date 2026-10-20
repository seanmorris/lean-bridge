#!/usr/bin/env node
/**
 * Record exact source edits that retain callback Subtype browser artifacts.
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
	callbackSubtypeBrowserArtifactChangedPaths
	, callbackSubtypeBrowserArtifactHistoryPath
	, callbackSubtypeBrowserArtifactImplementation
	, callbackSubtypeBrowserArtifactPredecessor
	, reverseCallbackSubtypeBrowserArtifactUpdate
} from "../tests/helpers/callback-subtype-browser-artifact-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackSubtypeBrowserArtifactImplementation
	, "Callback Subtype browser artifact history is draft-only at its implementation commit");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackSubtypeBrowserArtifactHistoryPath]).trim(), ""
, "Never rewrite committed callback Subtype browser artifact history");

const addedPaths = Object.freeze([
	"scripts/update-callback-subtype-browser-artifact-source-history.mjs"
	, "tests/helpers/callback-subtype-browser-artifact-source-history.mjs"
	, "tests/helpers/callback-subtype-browser-artifact-source-history-tests.mjs"
]);
const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-subtype-browser-artifact-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${callbackSubtypeBrowserArtifactPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
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
	assert.equal(reverseCallbackSubtypeBrowserArtifactUpdate(
		current, update), previous);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackSubtypeBrowserArtifactChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, callbackSubtypeBrowserArtifactPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	const modified = git(["diff", "--name-only", "--diff-filter=M"
		, callbackSubtypeBrowserArtifactImplementation, "--"])
		.trim().split("\n").filter(Boolean);
	assert.deepEqual(modified, [
		"tests/callback-subtype-browser-ci.test.mjs"
		, "tests/helpers/callback-subtype-browser-ci-source-history-tests.mjs"
	]);
	await writeFile(callbackSubtypeBrowserArtifactHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "callback-subtype-browser-artifact-source-v1"
		, predecessorCommit: callbackSubtypeBrowserArtifactPredecessor
		, implementationCommit: callbackSubtypeBrowserArtifactImplementation
		, updates, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} updates and ${additions.length} additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
