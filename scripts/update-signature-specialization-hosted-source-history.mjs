#!/usr/bin/env node
/**
 * Record the hosted specialization archive/replay source milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationHostedAddedPaths
	, signatureSpecializationHostedChangedPaths
	, signatureSpecializationHostedHistoryPath
	, signatureSpecializationHostedImplementation
	, signatureSpecializationHostedImplementationAdditions
	, signatureSpecializationHostedPredecessor
} from "../tests/helpers/signature-specialization-hosted-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationHostedPredecessor;
const implementation = signatureSpecializationHostedImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Hosted specialization history requires its exact implementation commit");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...signatureSpecializationHostedChangedPaths
		, ...signatureSpecializationHostedImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationHostedHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Central history integration belongs to its own seal");
const additionsInWorktree = names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationHostedAddedPaths
]);
assert.deepEqual(additionsInWorktree
	, [...signatureSpecializationHostedAddedPaths].sort());

const updates = [];
for(const path of signatureSpecializationHostedChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const implementationAdditions = [];
for(const path of signatureSpecializationHostedImplementationAdditions)
{
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	implementationAdditions.push({
		path, currentSha256: sha256(git(["show", `${implementation}:${path}`]))
	});
}
const additions = [];
for(const path of signatureSpecializationHostedAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(signatureSpecializationHostedHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "signature-specialization-hosted-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, scope: "Bind the exact ten hosted producer lanes for the 45-cell generic, implicit and instance signature completion to terminal run, job, artifact, ZIP, API, log, report, TAP and transitive source identities. Independently validate all nine reviewed native profiles, all browser engine/variant/lifecycle observations and all twelve PHP-Wasm arrangements per route. Retain complete artifact ZIPs in Git-safe parts and reject incomplete or weakened reports. Make no support claim before the original hosted runs are terminal-green, archived, replayed and promoted."
	, implementationAdditions, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation updates, `
	+ `${implementationAdditions.length} implementation additions and `
	+ `${additions.length} history additions.\n`);
