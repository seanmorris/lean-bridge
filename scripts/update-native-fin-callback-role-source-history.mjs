#!/usr/bin/env node
/**
 * Record the never-recorded native Fin callback-role enablement (54426dd) and
 * this layer's added files from exact Git blobs. Hub integration is recorded
 * separately by the integrating seal.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	nativeFinCallbackRoleAddedPaths
	, nativeFinCallbackRoleChangedPaths
	, nativeFinCallbackRoleHistoryPath
	, nativeFinCallbackRoleImplementation
	, nativeFinCallbackRolePredecessor
	, reverseNativeFinCallbackRoleUpdate
} from "../tests/helpers/native-fin-callback-role-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const source = (revision, path) => git(["show", `${revision}:${path}`]);
const predecessor = nativeFinCallbackRolePredecessor;
const implementation = nativeFinCallbackRoleImplementation;

assert.equal(spawnSync("git", ["cat-file", "-e", `${implementation}^{commit}`]
	, { stdio: "ignore" }).status, 0
, "This history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor
	, "The implementation sits directly above its predecessor");
assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", implementation
	, "HEAD"], { stdio: "ignore" }).status, 0, "HEAD descends from 54426dd");
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `HEAD:${nativeFinCallbackRoleHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...nativeFinCallbackRoleChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...nativeFinCallbackRoleChangedPaths].sort());
// The live tree still carries exactly the 54426dd blobs, so the record reverses current sources.
assert.deepEqual(names(["diff", "--name-only", implementation, "HEAD", "--"
	, ...nativeFinCallbackRoleChangedPaths]), []);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Hub and registration integration belong to the integrating seal");
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...nativeFinCallbackRoleAddedPaths])
, [...nativeFinCallbackRoleAddedPaths].sort());

const updates = [];
for(const path of nativeFinCallbackRoleChangedPaths)
{
	const update = await gitSourceHistoryTransition(
		path, predecessor, implementation);
	assert.equal(reverseNativeFinCallbackRoleUpdate(
		source(implementation, path), update), source(predecessor, path), path);
	updates.push(update);
}
const additions = [];
for(const path of nativeFinCallbackRoleAddedPaths)
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
await writeFile(nativeFinCallbackRoleHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "native-fin-callback-role-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, scope: "Record the 22 source transitions of 54426dd (Enable Fin callback roles in native packages), which changed the native C, .NET, JVM, Perl, PHP, Python, Ruby, Rust and WIT callable-graph models and packages, the native component, graph model and graph source builders, the native C-family release and two native callable tests without any reversible history. Producer-era verifiers can then reconstruct the exact earlier sources through the Fin history hub. No source, claim, observation, evidence payload or pin changes. Hub and registration integration are recorded by the integrating seal."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} updates and `
	+ `${additions.length} additions.\n`);
