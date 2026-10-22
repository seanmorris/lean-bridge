#!/usr/bin/env node
/**
 * Record the exact owned checked-record callback/closure foundation and
 * refresh only current type-surface pointers that name its changed sources.
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
	ownedCheckedRecordCallableAddedPaths
	, ownedCheckedRecordCallableChangedPaths
	, ownedCheckedRecordCallableHistoricalPaths
	, ownedCheckedRecordCallableHistoryPath
	, ownedCheckedRecordCallableImplementation
	, ownedCheckedRecordCallablePredecessor
	, reverseOwnedCheckedRecordCallableUpdate
} from "../tests/helpers/owned-checked-record-callable-source-history.mjs";

const git = args => execFileSync("git", args
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedCheckedRecordCallableImplementation
	, "Owned checked-record callable history is draft-only at its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, ownedCheckedRecordCallablePredecessor
	, "Owned checked-record callable implementation must keep its exact predecessor");
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, ownedCheckedRecordCallableHistoryPath]).trim(), ""
, "Never rewrite committed owned checked-record callable history");
assert.deepEqual(git(["diff", "--name-only"
	, ownedCheckedRecordCallablePredecessor
	, ownedCheckedRecordCallableImplementation])
	.trim().split("\n").filter(Boolean).sort()
, [...ownedCheckedRecordCallableHistoricalPaths].sort());
assert.deepEqual(git(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedCheckedRecordCallableAddedPaths])
	.trim().split("\n").filter(Boolean).sort()
, [...ownedCheckedRecordCallableAddedPaths].sort());

const typeSurfacePath = "docs/type-surface.v1.json";
const sourceTransitions = new Map();
for(const path of ownedCheckedRecordCallableChangedPaths)
{
	if(path === typeSurfacePath) continue;
	const previous = git(["show"
		, `${ownedCheckedRecordCallablePredecessor}:${path}`]);
	const current = await readFile(path, "utf8");
	assert.notEqual(current, previous, path);
	sourceTransitions.set(path, {
		previous: sha256(previous), current: sha256(current)
	});
}

const typeSurface = JSON.parse(git(["show"
	, `${ownedCheckedRecordCallablePredecessor}:${typeSurfacePath}`]));
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
	, "The owned checked-record callable milestone must refresh current source pointers");
await writeFile(typeSurfacePath, JSON.stringify(typeSurface, null, 2) + "\n");

assert.deepEqual(git(["diff", "--name-only", "--diff-filter=M"
	, ownedCheckedRecordCallableImplementation, "--"])
	.trim().split("\n").filter(Boolean).sort()
, [
	typeSurfacePath
	, "tests/helpers/dependent-record-constructor-authority-source-history-tests.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
	, "tests/owned-checked-record-foundation.test.mjs"
].sort());

const directory = await mkdtemp(join(
	tmpdir(), "lean-bridge-owned-checked-callable-history-"
));
const transition = async path => {
	const previous = git(["show"
		, `${ownedCheckedRecordCallablePredecessor}:${path}`]);
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
	assert.equal(reverseOwnedCheckedRecordCallableUpdate(
		current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of ownedCheckedRecordCallableChangedPaths)
		updates.push(await transition(path));
	const additions = [];
	for(const path of ownedCheckedRecordCallableAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${ownedCheckedRecordCallablePredecessor}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(ownedCheckedRecordCallableHistoryPath
		, JSON.stringify({
			schemaVersion: 1
			, milestone: "owned-checked-record-callable-source-v1"
			, predecessorCommit: ownedCheckedRecordCallablePredecessor
			, implementationCommit: ownedCheckedRecordCallableImplementation
			, repairedTypeSurfacePointers: pointerUpdates.length
			, pointerUpdates, additions, updates
		}, null, 2) + "\n", { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} owned checked-record callable transitions, ${additions.length} additions and ${pointerUpdates.length} refreshed pointers.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
