#!/usr/bin/env node
/**
 * Record the installed generic, implicit and instance signature completion.
 * Central history and Core-partition integration are sealed separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	signatureSpecializationCompletionAddedPaths
	, signatureSpecializationCompletionChangedPaths
	, signatureSpecializationCompletionCommits
	, signatureSpecializationCompletionHistoryPath
	, signatureSpecializationCompletionImplementation
	, signatureSpecializationCompletionImplementationAdditions
	, signatureSpecializationCompletionPredecessor
} from "../tests/helpers/signature-specialization-completion-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = signatureSpecializationCompletionPredecessor;
const implementation = signatureSpecializationCompletionImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Signature specialization history requires its exact implementation commit");
const commits = git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n");
assert.deepEqual(commits, signatureSpecializationCompletionCommits);
for(const [index, revision] of signatureSpecializationCompletionCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim(), index === 0
		? predecessor : signatureSpecializationCompletionCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...signatureSpecializationCompletionChangedPaths
		, ...signatureSpecializationCompletionImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${signatureSpecializationCompletionHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Central history integration belongs to its own seal");
const additionsInWorktree = names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...signatureSpecializationCompletionAddedPaths
]);
assert.deepEqual(additionsInWorktree
	, [...signatureSpecializationCompletionAddedPaths].sort());

const updates = [];
for(const path of signatureSpecializationCompletionChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const implementationAdditions = [];
for(const path of signatureSpecializationCompletionImplementationAdditions)
{
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	const source = git(["show", `${implementation}:${path}`]);
	implementationAdditions.push({ path, currentSha256: sha256(source) });
}
const additions = [];
for(const path of signatureSpecializationCompletionAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(signatureSpecializationCompletionHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "signature-specialization-completion-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: signatureSpecializationCompletionCommits
	, scope: "Add source-free installed execution for all 45 outstanding generic, implicit and instance signature cells: 27 reviewed native cells across nine downstream profiles, six ordinary/reviewed PHP-Wasm cells, and twelve ordinary/reviewed browser cells across JavaScript, React and dedicated workers. Exercise compiler-selected dictionaries, concrete signatures and absent open generics; retain exact hosted reports. Refresh only the two pre-existing live pins of the extended specialization test. Make no support claim or evidence promotion before hosted validation."
	, implementationAdditions, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation updates, `
	+ `${implementationAdditions.length} implementation additions and `
	+ `${additions.length} history additions.\n`);
