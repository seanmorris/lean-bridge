#!/usr/bin/env node
/**
 * Record the owned checked-record npm/browser package-retention transition.
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
	ownedCheckedRecordJavaScriptRetentionAddedPaths
	, ownedCheckedRecordJavaScriptRetentionHistoryPath
	, ownedCheckedRecordJavaScriptRetentionImplementation
	, ownedCheckedRecordJavaScriptRetentionImplementationPaths
	, ownedCheckedRecordJavaScriptRetentionIntegrationPaths
	, ownedCheckedRecordJavaScriptRetentionModifiedPaths
	, ownedCheckedRecordJavaScriptRetentionPredecessor
	, reverseOwnedCheckedRecordJavaScriptRetentionUpdate
} from "../tests/helpers/owned-checked-record-javascript-retention-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordJavaScriptRetentionImplementation
	, "Owned checked-record JavaScript retention history requires its implementation commit");
assert.equal(git(["rev-parse"
	, `${ownedCheckedRecordJavaScriptRetentionImplementation}^`]).trim()
, ownedCheckedRecordJavaScriptRetentionPredecessor);
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordJavaScriptRetentionPredecessor
	, ownedCheckedRecordJavaScriptRetentionImplementation]).trim()
	.split("\n").sort()
, [...ownedCheckedRecordJavaScriptRetentionImplementationPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRecordJavaScriptRetentionHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-record-javascript-retention-history-"));
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
		return { start: currentLines.slice(0, currentStart).join("").length
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("") };
	});
	assert.ok(edits.length > 0, path);
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.equal(reverseOwnedCheckedRecordJavaScriptRetentionUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordJavaScriptRetentionModifiedPaths)
		updates.push(await transitionSources(path
			, git(["show", `${ownedCheckedRecordJavaScriptRetentionPredecessor}:${path}`])
			, git(["show", `${ownedCheckedRecordJavaScriptRetentionImplementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of ownedCheckedRecordJavaScriptRetentionIntegrationPaths)
		integrationUpdates.push(await transitionSources(path
			, git(["show", `${ownedCheckedRecordJavaScriptRetentionImplementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedRecordJavaScriptRetentionAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, ownedCheckedRecordJavaScriptRetentionPredecessor, "--", path]).trim()
		, "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedCheckedRecordJavaScriptRetentionHistoryPath
		, canonicalJson({ schemaVersion: 1
			, milestone: "owned-checked-record-javascript-retention-v1"
			, predecessorCommit: ownedCheckedRecordJavaScriptRetentionPredecessor
			, implementationCommit: ownedCheckedRecordJavaScriptRetentionImplementation
			, scope: "Retain every npm/browser owned checked-record package set before installation, install from those exact bytes, upload the complete sets, and independently verify every route, receipt, archive and browser cell."
			, additions, updates, integrationUpdates }), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
