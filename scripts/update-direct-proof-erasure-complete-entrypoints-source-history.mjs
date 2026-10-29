#!/usr/bin/env node
/**
 * Record the complete proof-erasure audit entry points.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	directProofErasureCompleteEntrypointsHistoryAdditions as historyAdditions
	, directProofErasureCompleteEntrypointsHistoryPath as historyPath
	, directProofErasureCompleteEntrypointsImplementation as implementation
	, directProofErasureCompleteEntrypointsImplementationAdditions as implementationAdditions
	, directProofErasureCompleteEntrypointsImplementationPaths as implementationPaths
	, directProofErasureCompleteEntrypointsIntegrationPaths as integrationPaths
	, directProofErasureCompleteEntrypointsPredecessor as predecessor
} from "../tests/helpers/direct-proof-erasure-complete-entrypoints-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-complete-entrypoints-source-history.mjs");
assert.equal(existsSync(historyPath), false, `${historyPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), [...implementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 16 * 1024 * 1024 }));
const implementationSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));

const directory = await mkdtemp(join(
	tmpdir(), "lean-proof-erasure-complete-entrypoints-"));
try
{
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
		"git", arguments_, {
			encoding: "utf8", maxBuffer: 64 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate proof-erasure completion entry points\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "direct-proof-erasure-complete-entrypoints-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, scope: "Add the two workflow-owned top-level audit entry points that independently replay the complete hosted proof-erasure archive and verify the exact 204-cell publication. Bind both entry points into the promotion source pins without claiming hosted acceptance or promoted support before evidence exists."
		, updates, implementationAdditions: implementationSources
		, integrationUpdates, historyAdditions: additions
		, auditEntrypoints: 2, hostedLanes: 10, cells: 204
		, currentSourcePaths: []
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} entry-point transition, `
		+ `${implementationSources.length} additions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
