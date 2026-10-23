#!/usr/bin/env node
/**
 * Record the exact WIT recursive reader traversal repair transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { reconcileDependentCheckedRecordSourcePins } from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	witRecursiveReaderTraversalRepairAddedPaths
	, witRecursiveReaderTraversalRepairApplied
	, witRecursiveReaderTraversalRepairHistoryPath
	, witRecursiveReaderTraversalRepairImplementation
	, witRecursiveReaderTraversalRepairIntegrationBase
	, witRecursiveReaderTraversalRepairIntegrationPaths
	, witRecursiveReaderTraversalRepairModifiedPaths
	, witRecursiveReaderTraversalRepairPredecessor
	, reverseWitRecursiveReaderTraversalRepairUpdate
} from "../tests/helpers/wit-recursive-reader-traversal-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation = witRecursiveReaderTraversalRepairImplementation;
const predecessor = witRecursiveReaderTraversalRepairPredecessor;
const integrationBase = witRecursiveReaderTraversalRepairIntegrationBase;
const applied = witRecursiveReaderTraversalRepairApplied;
const inventoryPath = "docs/type-surface.v1.json";
const hubPaths = witRecursiveReaderTraversalRepairIntegrationPaths
	.filter(path => path !== inventoryPath);

assert.equal(git(["rev-parse", "HEAD"]).trim(), git(["rev-parse", applied]).trim()
	, "This history requires its applied integration commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), git(["rev-parse", integrationBase]).trim()
	, "This history requires its exact integration base");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${applied}:${witRecursiveReaderTraversalRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...witRecursiveReaderTraversalRepairModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hubPaths].sort());

// Refresh exactly the live pins of the implementation sources and the
// history integration sources; immutable archive pins are never rewritten.
const inventory = JSON.parse(source(applied, inventoryPath));
const liveDigests = new Map();
for(const path of [...witRecursiveReaderTraversalRepairModifiedPaths, ...hubPaths])
	liveDigests.set(path, sha256(await readFile(path)));
assert.ok([...liveDigests.keys()].every(path =>
	!path.startsWith("docs/evidence/")));
const pinned = reconcileDependentCheckedRecordSourcePins(
	inventory, liveDigests);
assert.ok(pinned.refreshed > 0
	, "History integration must refresh its live source pins");
await writeFile(inventoryPath
	, JSON.stringify(pinned.inventory, null, 2) + "\n");

assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...witRecursiveReaderTraversalRepairIntegrationPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-wit-recursive-reader-traversal-repair-history-"));
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
	const update = {
		path, previousSha256: sha256(previous), currentSha256: sha256(current)
		, edits
	};
	assert.ok(edits.length > 0, path);
	assert.equal(reverseWitRecursiveReaderTraversalRepairUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of witRecursiveReaderTraversalRepairModifiedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const integrationUpdates = [];
	for(const path of witRecursiveReaderTraversalRepairIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(integrationBase, path), await readFile(path, "utf8")));
	const additions = [];
	for(const path of witRecursiveReaderTraversalRepairAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${applied}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(witRecursiveReaderTraversalRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "wit-recursive-reader-traversal-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, integrationBaseCommit: git(["rev-parse", integrationBase]).trim()
		, appliedCommit: git(["rev-parse", applied]).trim()
		, scope: "Let the WIT recursive-callable reader return through every later authenticated layer before reversing its own transition, delegate paths outside its record to that chain, stop the C structured-callable regression at its exact milestones, and refresh the live source pins of the repaired sources."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions; refreshed `
		+ `${pinned.refreshed} live source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
