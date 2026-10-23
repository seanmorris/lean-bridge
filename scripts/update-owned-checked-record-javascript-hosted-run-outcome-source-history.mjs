#!/usr/bin/env node
/**
 * Record the JavaScript hosted-run outcome qualification transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	ownedCheckedRecordJavaScriptHostedRunOutcomeAddedPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomeHistoryPath
	, ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation
	, ownedCheckedRecordJavaScriptHostedRunOutcomeImplementationPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths
	, ownedCheckedRecordJavaScriptHostedRunOutcomePredecessor
	, reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate
} from "../tests/helpers/owned-checked-record-javascript-hosted-run-outcome-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation
	= ownedCheckedRecordJavaScriptHostedRunOutcomeImplementation;
const predecessor = ownedCheckedRecordJavaScriptHostedRunOutcomePredecessor;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "This history requires its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${ownedCheckedRecordJavaScriptHostedRunOutcomeHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...ownedCheckedRecordJavaScriptHostedRunOutcomeImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths]
	.sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-checked-record-javascript-run-outcome-history-"));
const transition = async (path, previous, current) => {
	const previousPath = join(directory, "previous");
	const currentPath = join(directory, "current");
	await writeFile(previousPath, previous);
	await writeFile(currentPath, current);
	let diff;
	try
	{
		diff = execFileSync("diff", ["--speed-large-files", "--unified=0"
			, previousPath, currentPath]
		, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
	}
	catch(error)
	{
		if(error.status !== 1 || typeof error.stdout !== "string") throw error;
		diff = error.stdout;
	}
	const previousLines = previous.split(/(?<=\n)/u);
	const currentLines = current.split(/(?<=\n)/u);
	const offsets = [0];
	for(const line of currentLines) offsets.push(offsets.at(-1) + line.length);
	const edits = [...diff.matchAll(
		/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gmu
	)].map(match => {
		const previousCount = Number(match[2] ?? 1);
		const currentCount = Number(match[4] ?? 1);
		const previousStart = Number(match[1]) - (previousCount ? 1 : 0);
		const currentStart = Number(match[3]) - (currentCount ? 1 : 0);
		return {
			start: offsets[currentStart]
			, previous: previousLines.slice(previousStart
				, previousStart + previousCount).join("")
			, current: currentLines.slice(currentStart
				, currentStart + currentCount).join("")
		};
	});
	const update = { path, previousSha256: sha256(previous)
		, currentSha256: sha256(current), edits };
	assert.ok(edits.length > 0, path);
	assert.equal(reverseOwnedCheckedRecordJavaScriptHostedRunOutcomeUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordJavaScriptHostedRunOutcomeModifiedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const integrationUpdates = [];
	for(const path of ownedCheckedRecordJavaScriptHostedRunOutcomeIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(implementation, path), await readFile(path, "utf8")));
	const additions = [];
	for(const path of ownedCheckedRecordJavaScriptHostedRunOutcomeAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedCheckedRecordJavaScriptHostedRunOutcomeHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "owned-checked-record-javascript-hosted-run-outcome-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "Accept a successful owned JavaScript producer job from either a successful or failed enclosing consumer matrix, record the exact enclosing conclusion, reject canceled runs, and authenticate the exact source transition."
			, updates, additions, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
