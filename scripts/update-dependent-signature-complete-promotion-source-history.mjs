#!/usr/bin/env node
/**
 * Record the complete dependent-signature publication and history join.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	dependentSignatureCompletePromotionChangedPaths
	, dependentSignatureCompletePromotionCommits
	, dependentSignatureCompletePromotionGuidePaths
	, dependentSignatureCompletePromotionHistoryAdditions
	, dependentSignatureCompletePromotionHistoryPath
	, dependentSignatureCompletePromotionImplementation
	, dependentSignatureCompletePromotionIntegrationPaths
	, dependentSignatureCompletePromotionPredecessor
} from "../tests/helpers/dependent-signature-complete-promotion-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const predecessor = dependentSignatureCompletePromotionPredecessor;
const implementation = dependentSignatureCompletePromotionImplementation;

assert.deepEqual(process.argv.slice(2), []);
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.deepEqual(git(["rev-list", "--reverse"
	, `${predecessor}..${implementation}`]).trim().split("\n")
, dependentSignatureCompletePromotionCommits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"])
, [...dependentSignatureCompletePromotionChangedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${dependentSignatureCompletePromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dependentSignatureCompletePromotionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentSignatureCompletePromotionHistoryAdditions])
, [...dependentSignatureCompletePromotionHistoryAdditions].sort());

const updates = [];
for(const path of dependentSignatureCompletePromotionChangedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 128 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-complete-promotion-history-"));
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
		, ...dependentSignatureCompletePromotionIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Integrate complete dependent-signature publication history\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of dependentSignatureCompletePromotionIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of dependentSignatureCompletePromotionHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(dependentSignatureCompletePromotionHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-signature-complete-promotion-source-v1"
			, predecessorCommit: predecessor
			, implementationCommit: implementation
			, implementationCommits: dependentSignatureCompletePromotionCommits
			, scope: "Replay the complete eleven-lane dependent-signature archive and same-run receipt, promote exactly 34 direct earlier-Nat Fin signature cells across 17 profiles and two author routes, add two observations, publish fourteen generated and author-facing guides, retain twenty exact reference files and twelve artifacts, preserve every unrelated support claim, and register the full transaction newest-first."
			, updates, integrationUpdates, historyAdditions
			, guidePaths: dependentSignatureCompletePromotionGuidePaths
			, cells: 34, observations: 2, referenceFiles: 20
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} publication transitions, `
		+ `${integrationUpdates.length} registrations, 34 cells, `
		+ "two observations and twenty reference files.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
