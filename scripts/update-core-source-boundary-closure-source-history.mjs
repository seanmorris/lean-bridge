#!/usr/bin/env node
/**
 * Record the exact Core source boundary closure transition.
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
	coreSourceBoundaryClosureAddedPaths
	, coreSourceBoundaryClosureHistoryPath
	, coreSourceBoundaryClosureImplementation
	, coreSourceBoundaryClosureImplementationAdditions
	, coreSourceBoundaryClosureImplementationPaths
	, coreSourceBoundaryClosureIntegrationPaths
	, coreSourceBoundaryClosureModifiedPaths
	, coreSourceBoundaryClosurePredecessor
	, reverseCoreSourceBoundaryClosureUpdate
} from "../tests/helpers/core-source-boundary-closure-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const gitBytes = arguments_ => execFileSync("git", arguments_, {
	maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const implementation = coreSourceBoundaryClosureImplementation;
const predecessor = coreSourceBoundaryClosurePredecessor;
const inventoryPath = "docs/type-surface.v1.json";
const hubPaths = coreSourceBoundaryClosureIntegrationPaths
	.filter(path => path !== inventoryPath);

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its implementation commit");
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor
	, "This history requires its exact predecessor");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreSourceBoundaryClosureHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...coreSourceBoundaryClosureModifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreSourceBoundaryClosureImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...coreSourceBoundaryClosureImplementationAdditions].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hubPaths].sort());

// Refresh exactly the live pins of the implementation sources and the
// history integration sources; immutable archive pins are never rewritten.
const inventory = JSON.parse(source(implementation, inventoryPath));
const liveDigests = new Map();
for(const path of [...coreSourceBoundaryClosureModifiedPaths, ...hubPaths])
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
	, "--"]), [...coreSourceBoundaryClosureIntegrationPaths].sort());

const directory = await mkdtemp(join(tmpdir(), "lean-core-source-boundary-closure-history-"));
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
	assert.equal(reverseCoreSourceBoundaryClosureUpdate(current, update), previous, path);
	return update;
};

try
{
	const updates = [];
	for(const path of coreSourceBoundaryClosureModifiedPaths)
		updates.push(await transition(path
			, source(predecessor, path), source(implementation, path)));
	const integrationUpdates = [];
	for(const path of coreSourceBoundaryClosureIntegrationPaths)
		integrationUpdates.push(await transition(path
			, source(implementation, path), await readFile(path, "utf8")));
	const implementationAdditions = [];
	for(const path of coreSourceBoundaryClosureImplementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0, path);
		const bytes = gitBytes(["show", `${implementation}:${path}`]);
		implementationAdditions.push({ path, currentSha256: sha256(bytes) });
	}
	const additions = [];
	for(const path of coreSourceBoundaryClosureAddedPaths)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreSourceBoundaryClosureHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-source-boundary-closure-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Carry src/abi/owned-refinement-model.mjs in the filtered universal-core source so scripts/generate-lean-link-projection.mjs resolves its full module graph, prove the boundary closes every core script root with an omitted-model control and a filtered-copy import, and refresh the live source pins of the changed files."
		, implementationAdditions, updates, additions, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions; refreshed `
		+ `${pinned.refreshed} live source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
