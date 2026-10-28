#!/usr/bin/env node
/**
 * Record the Fin hub order repair and this layer's added files from exact Git
 * blobs. Hub integration is recorded separately by the integrating seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	coreHubOrderRepairChangedPaths
	, coreHubOrderRepairCommits
	, coreHubOrderRepairHistoryAddedPaths
	, coreHubOrderRepairHistoryPath
	, coreHubOrderRepairImplementation
	, coreHubOrderRepairImplementationAddedPaths
	, coreHubOrderRepairPredecessor
	, reverseCoreHubOrderRepairUpdate
} from "../tests/helpers/core-hub-order-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = coreHubOrderRepairPredecessor;
const implementation = coreHubOrderRepairImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), coreHubOrderRepairCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of coreHubOrderRepairCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : coreHubOrderRepairCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreHubOrderRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreHubOrderRepairChangedPaths
		, ...coreHubOrderRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...coreHubOrderRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...coreHubOrderRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHubOrderRepairHistoryAddedPaths])
, [...coreHubOrderRepairHistoryAddedPaths].sort());

const updates = [];
for(const path of coreHubOrderRepairChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	// The layer tests replay the streamed inventory transition byte for byte.
	if(path !== "docs/type-surface.v1.json")
		assert.equal(reverseCoreHubOrderRepairUpdate(
			source(implementation, path), update), source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of coreHubOrderRepairImplementationAddedPaths)
{
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), source(implementation, path), path);
	additions.push({ path, currentSha256: sha256(bytes) });
}
for(const path of coreHubOrderRepairHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(coreHubOrderRepairHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-hub-order-repair-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: coreHubOrderRepairCommits
	, scope: "Restore newest-first order in the reversible Fin source-history hub: reverse the callback Fin diagnostic-contract layer (recorded above the Core memory-bound integration) before the memory-bound layers, and hook the authenticated replay-chain memory layer directly under its integration. Read the Perl callback Fin runtime integration sources and additions and the reviewed Fin Wasm Lean and JavaScript fixtures at their authenticated milestones instead of the live tree. Exactly the four type-surface pins of the edited reviewed Fin Wasm evidence helper are refreshed. No claim, observation, evidence payload or other pin changes. Hub and registration integration of this layer are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
