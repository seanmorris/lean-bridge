#!/usr/bin/env node
/**
 * Record the WIT callback checked-record diagnostic-oracle repair.
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
	callbackCheckedRecordWitDiagnosticRepairAddedPaths
	, callbackCheckedRecordWitDiagnosticRepairChangedPaths
	, callbackCheckedRecordWitDiagnosticRepairHistoryPath
	, callbackCheckedRecordWitDiagnosticRepairImplementation
	, callbackCheckedRecordWitDiagnosticRepairIntegrationPaths
	, callbackCheckedRecordWitDiagnosticRepairPredecessor
	, reverseCallbackCheckedRecordWitDiagnosticRepairUpdate
} from "../tests/helpers/callback-checked-record-wit-diagnostic-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = args => git(args).trim().split("\n").filter(Boolean).sort();
const implementation = callbackCheckedRecordWitDiagnosticRepairImplementation;
const predecessor = callbackCheckedRecordWitDiagnosticRepairPredecessor;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "WIT callback diagnostic history requires its implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackCheckedRecordWitDiagnosticRepairChangedPaths].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackCheckedRecordWitDiagnosticRepairHistoryPath]).trim(), "");

const directory = await mkdtemp(join(
	tmpdir(), "lean-callback-wit-diagnostic-history-"
));
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
			, previous: previousLines.slice(
				previousStart, previousStart + previousCount).join("")
			, current: currentLines.slice(
				currentStart, currentStart + currentCount).join("")
		};
	});
	assert.ok(edits.length > 0, path);
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.equal(reverseCallbackCheckedRecordWitDiagnosticRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackCheckedRecordWitDiagnosticRepairChangedPaths)
		updates.push(await transition(path
			, git(["show", `${predecessor}:${path}`])
			, git(["show", `${implementation}:${path}`])));
	const integrationUpdates = [];
	for(const path of callbackCheckedRecordWitDiagnosticRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, git(["show", `${implementation}:${path}`])
			, await readFile(path, "utf8")));
	const additions = [];
	for(const path of callbackCheckedRecordWitDiagnosticRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackCheckedRecordWitDiagnosticRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "callback-checked-record-wit-diagnostic-repair-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, scope: "The WIT callback checked-record consumer authenticates the exact returned-closure constructor and field diagnostics emitted by the native Lean refinement boundary."
			, additions, updates, integrationUpdates
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration updates.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
