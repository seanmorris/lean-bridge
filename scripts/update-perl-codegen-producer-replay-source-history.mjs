#!/usr/bin/env node
/**
 * Record the Perl codegen producer replay and this layer's added files from exact Git
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
	perlCodegenProducerReplayChangedPaths
	, perlCodegenProducerReplayCommits
	, perlCodegenProducerReplayHistoryAddedPaths
	, perlCodegenProducerReplayHistoryPath
	, perlCodegenProducerReplayImplementation
	, perlCodegenProducerReplayImplementationAddedPaths
	, perlCodegenProducerReplayPredecessor
	, reversePerlCodegenProducerReplayUpdate
} from "../tests/helpers/perl-codegen-producer-replay-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = perlCodegenProducerReplayPredecessor;
const implementation = perlCodegenProducerReplayImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), perlCodegenProducerReplayCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of perlCodegenProducerReplayCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : perlCodegenProducerReplayCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${perlCodegenProducerReplayHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...perlCodegenProducerReplayChangedPaths
		, ...perlCodegenProducerReplayImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...perlCodegenProducerReplayChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...perlCodegenProducerReplayImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...perlCodegenProducerReplayHistoryAddedPaths])
, [...perlCodegenProducerReplayHistoryAddedPaths].sort());

const updates = [];
for(const path of perlCodegenProducerReplayChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	// The layer tests replay the streamed inventory transition byte for byte.
	if(path !== "docs/type-surface.v1.json")
		assert.equal(reversePerlCodegenProducerReplayUpdate(
			source(implementation, path), update), source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of perlCodegenProducerReplayImplementationAddedPaths)
{
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), source(implementation, path), path);
	additions.push({ path, currentSha256: sha256(bytes) });
}
for(const path of perlCodegenProducerReplayHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(perlCodegenProducerReplayHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "perl-codegen-producer-replay-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: perlCodegenProducerReplayCommits
	, scope: "Replay the Perl structured codegen regression with the exact generator closure that produced its frozen fixtures (8538d3f, whose generate.mjs and copied-aliases.mjs digests the record pins) instead of the live generator that 54426dd changed. The regression becomes asynchronous and both callers await it; a forged generator digest is refused. Exactly the seven type-surface pins of the three edited helpers are refreshed. No claim, observation, evidence payload or other pin changes. Hub and registration integration are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
