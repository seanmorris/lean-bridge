#!/usr/bin/env node
/**
 * Record the direct proof-erasure archive lane-identity repair.
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
	directProofErasureArchiveLaneIdentityRepairHistoryAdditions
	, directProofErasureArchiveLaneIdentityRepairHistoryPath
	, directProofErasureArchiveLaneIdentityRepairImplementation
	, directProofErasureArchiveLaneIdentityRepairImplementationPaths
	, directProofErasureArchiveLaneIdentityRepairIntegrationPaths
	, directProofErasureArchiveLaneIdentityRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-archive-lane-identity-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-archive-lane-identity-repair-source-history.mjs");
assert.equal(existsSync(
	directProofErasureArchiveLaneIdentityRepairHistoryPath), false
, `${directProofErasureArchiveLaneIdentityRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureArchiveLaneIdentityRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureArchiveLaneIdentityRepairImplementation}^`]).trim()
, directProofErasureArchiveLaneIdentityRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureArchiveLaneIdentityRepairPredecessor
	, directProofErasureArchiveLaneIdentityRepairImplementation, "--"])
, [...directProofErasureArchiveLaneIdentityRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureArchiveLaneIdentityRepairPredecessor
	, directProofErasureArchiveLaneIdentityRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureArchiveLaneIdentityRepairImplementation}`
		+ `:${directProofErasureArchiveLaneIdentityRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...directProofErasureArchiveLaneIdentityRepairIntegrationPaths])
, [...directProofErasureArchiveLaneIdentityRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureArchiveLaneIdentityRepairHistoryAdditions])
, [...directProofErasureArchiveLaneIdentityRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureArchiveLaneIdentityRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureArchiveLaneIdentityRepairPredecessor
		, directProofErasureArchiveLaneIdentityRepairImplementation
		, { maximumEditBytes: 16 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-archive-lane-identity-repair-"));
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
	temporaryGit(["read-tree"
		, directProofErasureArchiveLaneIdentityRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureArchiveLaneIdentityRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureArchiveLaneIdentityRepairImplementation
	], { input: "Authenticate proof archive lane identity\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureArchiveLaneIdentityRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureArchiveLaneIdentityRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasureArchiveLaneIdentityRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureArchiveLaneIdentityRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone:
				"direct-proof-erasure-archive-lane-identity-repair-source-v1"
			, predecessorCommit:
				directProofErasureArchiveLaneIdentityRepairPredecessor
			, implementationCommit:
				directProofErasureArchiveLaneIdentityRepairImplementation
			, scope: "Resolve each authenticated hosted lane wrapper to its unique canonical matrix-lane object before invoking identity-checked aggregate receipt path construction."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 41021643593, canonicalLaneIdentity: true
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} lane-identity repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
