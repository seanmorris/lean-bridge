#!/usr/bin/env node
/**
 * Record the deterministic Core evidence-boundary repairs from exact Git
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
	coreDeterministicBoundaryRepairChangedPaths
	, coreDeterministicBoundaryRepairCommits
	, coreDeterministicBoundaryRepairHistoryAddedPaths
	, coreDeterministicBoundaryRepairHistoryPath
	, coreDeterministicBoundaryRepairImplementation
	, coreDeterministicBoundaryRepairImplementationAddedPaths
	, coreDeterministicBoundaryRepairPredecessor
	, reverseCoreDeterministicBoundaryRepairUpdate
} from "../tests/helpers/core-deterministic-boundary-repair-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = coreDeterministicBoundaryRepairPredecessor;
const implementation = coreDeterministicBoundaryRepairImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, coreDeterministicBoundaryRepairCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of coreDeterministicBoundaryRepairCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor
			: coreDeterministicBoundaryRepairCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${coreDeterministicBoundaryRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...coreDeterministicBoundaryRepairChangedPaths
		, ...coreDeterministicBoundaryRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...coreDeterministicBoundaryRepairChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...coreDeterministicBoundaryRepairImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreDeterministicBoundaryRepairHistoryAddedPaths])
, [...coreDeterministicBoundaryRepairHistoryAddedPaths].sort());

const updates = [];
for(const path of coreDeterministicBoundaryRepairChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	if(path !== "docs/type-surface.v1.json")
		assert.equal(reverseCoreDeterministicBoundaryRepairUpdate(
			source(implementation, path), update)
		, source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of coreDeterministicBoundaryRepairImplementationAddedPaths)
{
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), source(implementation, path), path);
	additions.push({ path, currentSha256: sha256(bytes) });
}
for(const path of coreDeterministicBoundaryRepairHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(coreDeterministicBoundaryRepairHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "core-deterministic-boundary-repair-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: coreDeterministicBoundaryRepairCommits
	, scope: "Repair five deterministic Core defects without changing support claims or retained observations: materialize structural-Subtype sparse archives through eleven literal prefixes; read the Perl constructor contract and owned checked-record matrix at their authenticated milestones; stop C, native-PHP and WIT historical closure walks at each retained source identity. Refresh exactly 24 live pins for the edited structural promotion helper and preserve every other inventory byte. Hub and registration integration are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
