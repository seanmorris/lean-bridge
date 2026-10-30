#!/usr/bin/env node
/**
 * Record the complete hosted HostNull publication and history join.
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
	hostNullCompletePromotionHistoryAdditions
	, hostNullCompletePromotionHistoryPath
	, hostNullCompletePromotionImplementation
	, hostNullCompletePromotionImplementationAdditions
	, hostNullCompletePromotionImplementationPaths
	, hostNullCompletePromotionIntegrationPaths
	, hostNullCompletePromotionPredecessor
} from "../tests/helpers/host-null-complete-promotion-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-complete-promotion-source-history.mjs");
assert.equal(existsSync(hostNullCompletePromotionHistoryPath), false
	, `${hostNullCompletePromotionHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullCompletePromotionImplementation);
const parent = git(["rev-parse"
	, `${hostNullCompletePromotionImplementation}^`]).trim();
assert.equal(parent, hostNullCompletePromotionPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullCompletePromotionPredecessor
	, hostNullCompletePromotionImplementation, "--"])
, [...hostNullCompletePromotionImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullCompletePromotionPredecessor
	, hostNullCompletePromotionImplementation, "--"])
, [...hostNullCompletePromotionImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullCompletePromotionImplementation}:${hostNullCompletePromotionHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...hostNullCompletePromotionIntegrationPaths])
, [...hostNullCompletePromotionIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullCompletePromotionHistoryAdditions])
, [...hostNullCompletePromotionHistoryAdditions].sort());

const updates = [];
for(const path of hostNullCompletePromotionImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, hostNullCompletePromotionPredecessor
		, hostNullCompletePromotionImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const implementationAdditions
	= hostNullCompletePromotionImplementationAdditions.map(path => ({
		path
		, sha256: sha256(git(["show"
			, `${hostNullCompletePromotionImplementation}:${path}`]))
	}));

const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-complete-promotion-history-"));
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
	temporaryGit(["read-tree", hostNullCompletePromotionImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullCompletePromotionIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", hostNullCompletePromotionImplementation
	], { input: "Authenticate complete hosted HostNull publication\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullCompletePromotionIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullCompletePromotionImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of hostNullCompletePromotionHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(hostNullCompletePromotionHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-complete-promotion-source-v1"
		, predecessorCommit: hostNullCompletePromotionPredecessor
		, implementationCommit: hostNullCompletePromotionImplementation
		, scope: "Replay one exact seven-lane hosted archive, promote exactly 170 explicit HostNull cells across seventeen profiles, two author routes and five positions, add 24 observations, publish fourteen generated and author-facing guides, refresh 131 generator-source pins and 70 generated-document pins, preserve Option, Unit, proof-erasure and omitted-argument distinctions, and register the complete transaction newest-first."
		, updates, implementationAdditions, integrationUpdates, historyAdditions
		, owner: 1220, cells: 170, stageEntries: 850, observations: 24
		, captures: 7, sourcePins: 131, documentationPins: 70
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} publication transitions, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
