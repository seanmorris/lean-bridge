#!/usr/bin/env node
/**
 * Record the inherited checked-record lane memory bound and this layer's added files from exact Git
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
	inheritedCheckedRecordLaneMemoryChangedPaths
	, inheritedCheckedRecordLaneMemoryCommits
	, inheritedCheckedRecordLaneMemoryHistoryAddedPaths
	, inheritedCheckedRecordLaneMemoryHistoryPath
	, inheritedCheckedRecordLaneMemoryImplementation
	, inheritedCheckedRecordLaneMemoryImplementationAddedPaths
	, inheritedCheckedRecordLaneMemoryPredecessor
	, reverseInheritedCheckedRecordLaneMemoryUpdate
} from "../tests/helpers/inherited-checked-record-lane-memory-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = inheritedCheckedRecordLaneMemoryPredecessor;
const implementation = inheritedCheckedRecordLaneMemoryImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "This history requires its exact implementation commit");
assert.deepEqual(git(["rev-list", "--reverse", `${predecessor}..${implementation}`])
	.trim().split("\n"), inheritedCheckedRecordLaneMemoryCommits
, "The implementation commits sit directly above their predecessor");
for(const [index, revision] of inheritedCheckedRecordLaneMemoryCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim()
		, index === 0 ? predecessor : inheritedCheckedRecordLaneMemoryCommits[index - 1]);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${inheritedCheckedRecordLaneMemoryHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...inheritedCheckedRecordLaneMemoryChangedPaths
		, ...inheritedCheckedRecordLaneMemoryImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...inheritedCheckedRecordLaneMemoryChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...inheritedCheckedRecordLaneMemoryImplementationAddedPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...inheritedCheckedRecordLaneMemoryHistoryAddedPaths])
, [...inheritedCheckedRecordLaneMemoryHistoryAddedPaths].sort());

const updates = [];
for(const path of inheritedCheckedRecordLaneMemoryChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	// The layer tests replay the streamed inventory transition byte for byte.
	if(path !== "docs/type-surface.v1.json")
		assert.equal(reverseInheritedCheckedRecordLaneMemoryUpdate(
			source(implementation, path), update), source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of inheritedCheckedRecordLaneMemoryImplementationAddedPaths)
{
	const bytes = await readFile(path);
	assert.equal(bytes.toString("utf8"), source(implementation, path), path);
	additions.push({ path, currentSha256: sha256(bytes) });
}
for(const path of inheritedCheckedRecordLaneMemoryHistoryAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(inheritedCheckedRecordLaneMemoryHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "inherited-checked-record-lane-memory-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: inheritedCheckedRecordLaneMemoryCommits
	, scope: "Bound the memory of the ten inherited checked-record lane checkers (browser, .NET, JVM, Perl, PHP, PHP-Wasm, Python, Ruby, Rust and WIT): a shared authenticated reader verifies every indexed archive file by exact size and SHA-256 in a hash-first pass without retaining its bytes, and re-reads and re-verifies each file whenever a run needs it, so no check holds a whole lane archive in memory. Every path, size, digest, order, absence and refusal guarantee is unchanged. Exactly the 440 type-surface pins of the ten edited checkers are refreshed. No claim, observation, evidence payload or other pin changes. Hub and registration integration are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
