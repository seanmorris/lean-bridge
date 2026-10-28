#!/usr/bin/env node
/**
 * Record the Perl callback Fin milestone-read repair and this layer's added files from exact Git
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
	callbackFinPerlMilestoneReadChangedPaths
	, callbackFinPerlMilestoneReadCommits
	, callbackFinPerlMilestoneReadHistoryAddedPaths
	, callbackFinPerlMilestoneReadHistoryPath
	, callbackFinPerlMilestoneReadImplementation
	, callbackFinPerlMilestoneReadImplementationAddedPaths
	, callbackFinPerlMilestoneReadPredecessor
	, reverseCallbackFinPerlMilestoneReadUpdate
} from "../tests/helpers/callback-fin-perl-milestone-read-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = callbackFinPerlMilestoneReadPredecessor;
const implementation = callbackFinPerlMilestoneReadImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), callbackFinPerlMilestoneReadCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of callbackFinPerlMilestoneReadCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : callbackFinPerlMilestoneReadCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${callbackFinPerlMilestoneReadHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...callbackFinPerlMilestoneReadChangedPaths
		, ...callbackFinPerlMilestoneReadImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...callbackFinPerlMilestoneReadChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...callbackFinPerlMilestoneReadImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...callbackFinPerlMilestoneReadHistoryAddedPaths])
, [...callbackFinPerlMilestoneReadHistoryAddedPaths].sort());

const updates = [];
for(const path of callbackFinPerlMilestoneReadChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	// The layer tests replay the streamed inventory transition byte for byte.
	if(path !== "docs/type-surface.v1.json")
		assert.equal(reverseCallbackFinPerlMilestoneReadUpdate(
			source(implementation, path), update), source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of callbackFinPerlMilestoneReadImplementationAddedPaths)
{
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), source(implementation, path), path);
	additions.push({ path, currentSha256: sha256(bytes) });
}
for(const path of callbackFinPerlMilestoneReadHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(callbackFinPerlMilestoneReadHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "callback-fin-perl-milestone-read-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: callbackFinPerlMilestoneReadCommits
	, scope: "Read the additions and integration sources of the Perl callback Fin direction and host repair layer tests at their authenticated milestones through the Fin history hub instead of rebuilding them from the live tree with partial reader chains. No claim, observation, evidence payload, hub order or type-surface pin changes. Hub and registration integration of this layer are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
