#!/usr/bin/env node
/**
 * Record the final Fin contract-test registration and its exact live-pin
 * refresh. Central history and Core-partition integration are sealed separately.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	finContractTestRegistrationAddedPaths
	, finContractTestRegistrationChangedPaths
	, finContractTestRegistrationCommits
	, finContractTestRegistrationHistoryPath
	, finContractTestRegistrationImplementation
	, finContractTestRegistrationPredecessor
} from "../tests/helpers/fin-contract-test-registration-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = finContractTestRegistrationPredecessor;
const implementation = finContractTestRegistrationImplementation;

assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Final Fin test-registration history requires its exact implementation commit");
const commits = git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n");
assert.deepEqual(commits, finContractTestRegistrationCommits);
for(const [index, revision] of finContractTestRegistrationCommits.entries())
	assert.equal(git(["rev-parse", `${revision}^`]).trim(), index === 0
		? predecessor : finContractTestRegistrationCommits[index - 1]);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...finContractTestRegistrationChangedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${finContractTestRegistrationHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--"]), []
	, "Central history integration belongs to its own seal");
const additionsInWorktree = names([
	"ls-files", "--others", "--exclude-standard", "--"
	, ...finContractTestRegistrationAddedPaths
]);
assert.deepEqual(additionsInWorktree
	, [...finContractTestRegistrationAddedPaths].sort());

const updates = [];
for(const path of finContractTestRegistrationChangedPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation));
const additions = [];
for(const path of finContractTestRegistrationAddedPaths)
{
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${implementation}:${path}`], { stdio: "ignore" }).status, 0, path);
	additions.push({ path, currentSha256: sha256(await readFile(path)) });
}
await writeFile(finContractTestRegistrationHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "fin-contract-test-registration-source-v1"
	, predecessorCommit: predecessor
	, implementationCommit: implementation
	, implementationCommits: finContractTestRegistrationCommits
	, scope: "Register exactly the fifteen final Fin tests in the closed contract profile, assert those registrations explicitly, and refresh only the 102 live type-surface pins of the two edited sources to their exact implementation blobs. Change no support claim, observation, evidence payload, runtime behavior or package surface. Central history and Core-partition integration are sealed separately."
	, additions, updates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation updates and `
	+ `${additions.length} additions.\n`);
