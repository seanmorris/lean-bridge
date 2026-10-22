#!/usr/bin/env node
/**
 * Record the exact C callback checked-record error-contract repair and refresh
 * only current type-surface pointers that name its changed sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sha256 } from "../src/capsule/node.mjs";
import {
	callbackCheckedRecordNativeErrorRepairAddedPaths
	, callbackCheckedRecordNativeErrorRepairChangedPaths
	, callbackCheckedRecordNativeErrorRepairHistoricalPaths
	, callbackCheckedRecordNativeErrorRepairHistoryPath
	, callbackCheckedRecordNativeErrorRepairImplementation
	, callbackCheckedRecordNativeErrorRepairPredecessor
	, reverseCallbackCheckedRecordNativeErrorRepairUpdate
} from "../tests/helpers/callback-checked-record-native-error-repair-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, callbackCheckedRecordNativeErrorRepairImplementation
	, "C callback checked-record error history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, callbackCheckedRecordNativeErrorRepairPredecessor
	, "C callback checked-record error repair must keep its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, callbackCheckedRecordNativeErrorRepairHistoryPath]).trim(), ""
, "Never rewrite committed C callback checked-record error history");
assert.deepEqual(git(["diff", "--name-only"
	, callbackCheckedRecordNativeErrorRepairPredecessor
	, callbackCheckedRecordNativeErrorRepairImplementation])
	.trim().split("\n").filter(Boolean).sort()
, [...callbackCheckedRecordNativeErrorRepairHistoricalPaths].sort());
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...callbackCheckedRecordNativeErrorRepairAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...callbackCheckedRecordNativeErrorRepairAddedPaths].sort());

const typeSurfacePath = "docs/type-surface.v1.json";
const sourceTransitions = new Map();
for(const path of callbackCheckedRecordNativeErrorRepairChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show"
		, `${callbackCheckedRecordNativeErrorRepairPredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const typeSurface = JSON.parse(git(["show"
	, `${callbackCheckedRecordNativeErrorRepairPredecessor}:${typeSurfacePath}`]));
const pointerUpdates = [];
for(const evidence of typeSurface.evidence)
	for(const file of evidence.files)
	{
		const transition = sourceTransitions.get(file.path);
		if(!transition || file.sha256 !== transition.previous) continue;
		file.sha256 = transition.current;
		pointerUpdates.push({ path: file.path, ...transition });
	}
assert.ok(pointerUpdates.length > 0
	, "The C callback error repair must refresh current source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, callbackCheckedRecordNativeErrorRepairImplementation, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [
	typeSurfacePath
	, "tests/callback-checked-record-native.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-callback-checked-record-c-error-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${callbackCheckedRecordNativeErrorRepairPredecessor}:${path}`]);
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
	assert.equal(reverseCallbackCheckedRecordNativeErrorRepairUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of callbackCheckedRecordNativeErrorRepairChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of callbackCheckedRecordNativeErrorRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${callbackCheckedRecordNativeErrorRepairPredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(callbackCheckedRecordNativeErrorRepairHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "callback-checked-record-native-error-repair-source-v1"
			, predecessorCommit: callbackCheckedRecordNativeErrorRepairPredecessor
			, implementationCommit: callbackCheckedRecordNativeErrorRepairImplementation
			, repairedTypeSurfacePointers: pointerUpdates.length
			, pointerUpdates, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} C callback error-contract transitions, ${additions.length} additions and ${pointerUpdates.length} refreshed pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
