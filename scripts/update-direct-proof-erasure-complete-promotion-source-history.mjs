#!/usr/bin/env node
/**
 * Record the complete direct proof-erasure publication and history join.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	directProofErasureCompletePromotionChangedPaths
	, directProofErasureCompletePromotionCommits
	, directProofErasureCompletePromotionHistoryAdditions
	, directProofErasureCompletePromotionHistoryPath
	, directProofErasureCompletePromotionImplementation
	, directProofErasureCompletePromotionIntegrationPaths
	, directProofErasureCompletePromotionPredecessor
} from "../tests/helpers/direct-proof-erasure-complete-promotion-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = directProofErasureCompletePromotionPredecessor;
const implementation = directProofErasureCompletePromotionImplementation;

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-complete-promotion-source-history.mjs");
assert.equal(existsSync(directProofErasureCompletePromotionHistoryPath), false
	, `${directProofErasureCompletePromotionHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, directProofErasureCompletePromotionCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...directProofErasureCompletePromotionChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${directProofErasureCompletePromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasureCompletePromotionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureCompletePromotionHistoryAdditions])
, [...directProofErasureCompletePromotionHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureCompletePromotionChangedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 128 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-complete-promotion-history-"));
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
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureCompletePromotionIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate complete direct proof-erasure publication\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of directProofErasureCompletePromotionIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of directProofErasureCompletePromotionHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureCompletePromotionHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-complete-promotion-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits:
				directProofErasureCompletePromotionCommits
			, scope: "Replay the immutable ten-lane hosted archive and fresh-Lean refusal, promote exactly 204 direct proof-erasure cells across seventeen profiles, two author routes and six direct positions, add two observations, publish sixteen inventory and documentation outputs, and register the transaction newest-first."
			, updates, integrationUpdates, historyAdditions
			, cells: 204, outputs: 16
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} publication transitions and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
