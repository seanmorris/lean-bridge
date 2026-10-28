#!/usr/bin/env node
/**
 * Record the Core shard-5 repair and this layer's added files from exact Git
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
	coreShardFiveRepairChangedPaths
	, coreShardFiveRepairCommits
	, coreShardFiveRepairHistoryAddedPaths
	, coreShardFiveRepairHistoryPath
	, coreShardFiveRepairImplementation
	, coreShardFiveRepairImplementationAddedPaths
	, coreShardFiveRepairPredecessor
	, reverseCoreShardFiveRepairUpdate
} from "../tests/helpers/core-shard-five-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = coreShardFiveRepairPredecessor;
const implementation = coreShardFiveRepairImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), coreShardFiveRepairCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of coreShardFiveRepairCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : coreShardFiveRepairCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreShardFiveRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreShardFiveRepairChangedPaths
		, ...coreShardFiveRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...coreShardFiveRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...coreShardFiveRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreShardFiveRepairHistoryAddedPaths])
, [...coreShardFiveRepairHistoryAddedPaths].sort());

const updates = [];
for(const path of coreShardFiveRepairChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	// The layer tests replay the streamed inventory transition byte for byte.
	if(path !== "docs/type-surface.v1.json")
		assert.equal(reverseCoreShardFiveRepairUpdate(
			source(implementation, path), update), source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of coreShardFiveRepairImplementationAddedPaths)
{
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), source(implementation, path), path);
	additions.push({ path, currentSha256: sha256(bytes) });
}
for(const path of coreShardFiveRepairHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(coreShardFiveRepairHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-shard-five-repair-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: coreShardFiveRepairCommits
	, scope: "Repair the deterministic Core shard-5 checks: the primitive PHP-Wasm and WIT promotion tests compare the predecessor prefix after restoring predecessor source pins and tie the full proposed inventory to the authenticated milestone, as the JVM promotion test does; the container integration history test proves each historical retained-evidence pin against its receipt-authenticated live pin in receipt mode and keeps direct byte hashing otherwise. Exactly the eight type-surface pins of the two edited promotion helpers are refreshed. No claim, observation, evidence payload or other pin changes. Hub and registration integration are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
