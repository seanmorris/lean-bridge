#!/usr/bin/env node
/**
 * Record the callback Fin milestone-read repair and this layer's added files from exact Git
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
	callbackFinMilestoneReadChangedPaths
	, callbackFinMilestoneReadCommits
	, callbackFinMilestoneReadHistoryAddedPaths
	, callbackFinMilestoneReadHistoryPath
	, callbackFinMilestoneReadImplementation
	, callbackFinMilestoneReadImplementationAddedPaths
	, callbackFinMilestoneReadPredecessor
	, reverseCallbackFinMilestoneReadUpdate
} from "../tests/helpers/callback-fin-milestone-read-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = callbackFinMilestoneReadPredecessor;
const implementation = callbackFinMilestoneReadImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), callbackFinMilestoneReadCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of callbackFinMilestoneReadCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : callbackFinMilestoneReadCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${callbackFinMilestoneReadHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackFinMilestoneReadChangedPaths
		, ...callbackFinMilestoneReadImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...callbackFinMilestoneReadChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...callbackFinMilestoneReadImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...callbackFinMilestoneReadHistoryAddedPaths])
, [...callbackFinMilestoneReadHistoryAddedPaths].sort());

const updates = [];
for(const path of callbackFinMilestoneReadChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	// The layer tests replay the streamed inventory transition byte for byte.
	if(path !== "docs/type-surface.v1.json")
		assert.equal(reverseCallbackFinMilestoneReadUpdate(
			source(implementation, path), update), source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of callbackFinMilestoneReadImplementationAddedPaths)
{
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), source(implementation, path), path);
	additions.push({ path, currentSha256: sha256(bytes) });
}
for(const path of callbackFinMilestoneReadHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(callbackFinMilestoneReadHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "callback-fin-milestone-read-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: callbackFinMilestoneReadCommits
	, scope: "Read the additions, integration sources and pinned type-surface inventory of six callback Fin and reviewed Fin layer tests at their authenticated milestones through the Fin history hub instead of the live tree, and reverse the merged hub-order integration (the newest recorded hub transition) before the hosted signature producer-binding integration so hub reversal reaches every recorded predecessor. No claim, observation, evidence payload or type-surface pin changes. Hub and registration integration of this layer are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
