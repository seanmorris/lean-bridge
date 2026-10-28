#!/usr/bin/env node
/**
 * Record the npm and browser direct proof-erasure acceptance lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	directProofErasureNpmAddedPaths
	, directProofErasureNpmChangedPaths
	, directProofErasureNpmHistoryPath
	, directProofErasureNpmImplementation
	, directProofErasureNpmImplementationAddedPaths
	, directProofErasureNpmIntegrationPaths
	, directProofErasureNpmPredecessor
} from "../tests/helpers/direct-proof-erasure-npm-source-history.mjs";

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-npm-source-history.mjs");
const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = directProofErasureNpmPredecessor;
const implementation = directProofErasureNpmImplementation;
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation
	, "Npm history requires its exact implementation head");
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation])
, [...directProofErasureNpmChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation])
, [...directProofErasureNpmImplementationAddedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${directProofErasureNpmHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");

const directory = await mkdtemp(join(tmpdir(), "lean-direct-proof-npm-history-"));
try
{
	const updates = [];
	for(const path of directProofErasureNpmChangedPaths)
		updates.push({ commit: implementation, parent: predecessor
			, ...await gitSourceHistoryTransition(path, predecessor, implementation) });
	const environment = {
		...process.env, GIT_INDEX_FILE: join(directory, "index")
		, GIT_AUTHOR_NAME: "Lean Bridge history writer"
		, GIT_AUTHOR_EMAIL: "history@example.invalid"
		, GIT_COMMITTER_NAME: "Lean Bridge history writer"
		, GIT_COMMITTER_EMAIL: "history@example.invalid"
		, GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z"
		, GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z"
	};
	const temporaryGit = (arguments_, options = {}) => execFileSync(
		"git", arguments_, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options }
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...directProofErasureNpmIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p", implementation]
		, { input: "Authenticate direct proof-erasure npm integration\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureNpmIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit));
	const additions = [];
	for(const path of directProofErasureNpmAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path]).trim()
			, "", path);
		const committed = spawnSync("git", ["cat-file", "-e"
			, `${implementation}:${path}`], { stdio: "ignore" }).status === 0;
		const source = committed ? git(["show", `${implementation}:${path}`])
			: await readFile(path);
		additions.push({ path, currentSha256: sha256(source) });
	}
	await writeFile(directProofErasureNpmHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "direct-proof-erasure-npm-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, scope: "Build ordinary and independently reviewed direct-proof packages twice; verify exact one-word adapters and receipts; remove author sources; install prepared npm archives offline; execute and relocate Node JavaScript and strict TypeScript consumers; and run browser JavaScript, React and dedicated Workers through all three engines and their complete failure/lifecycle phases."
		, additions, updates, integrationUpdates
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} npm transitions, `
		+ `${additions.length} additions and ${integrationUpdates.length} integrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
