#!/usr/bin/env node
/**
 * Record the combined PHP profile evidence repair.
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
	directProofErasurePhpProfileRepairHistoryAdditions
	, directProofErasurePhpProfileRepairHistoryPath
	, directProofErasurePhpProfileRepairImplementation
	, directProofErasurePhpProfileRepairImplementationPaths
	, directProofErasurePhpProfileRepairIntegrationPaths
	, directProofErasurePhpProfileRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-php-profile-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-php-profile-repair-source-history.mjs");
assert.equal(existsSync(directProofErasurePhpProfileRepairHistoryPath), false
	, `${directProofErasurePhpProfileRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasurePhpProfileRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasurePhpProfileRepairImplementation}^`]).trim()
, directProofErasurePhpProfileRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasurePhpProfileRepairPredecessor
	, directProofErasurePhpProfileRepairImplementation, "--"])
, [...directProofErasurePhpProfileRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasurePhpProfileRepairPredecessor
	, directProofErasurePhpProfileRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasurePhpProfileRepairImplementation}`
		+ `:${directProofErasurePhpProfileRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasurePhpProfileRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasurePhpProfileRepairHistoryAdditions])
, [...directProofErasurePhpProfileRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasurePhpProfileRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasurePhpProfileRepairPredecessor
		, directProofErasurePhpProfileRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-php-profile-repair-"));
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
	temporaryGit(["read-tree", directProofErasurePhpProfileRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasurePhpProfileRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasurePhpProfileRepairImplementation
	], { input: "Authenticate proof PHP profile repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasurePhpProfileRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasurePhpProfileRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of directProofErasurePhpProfileRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasurePhpProfileRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-php-profile-repair-source-v1"
			, predecessorCommit: directProofErasurePhpProfileRepairPredecessor
			, implementationCommit: directProofErasurePhpProfileRepairImplementation
			, scope: "Verify and retain both compiled PHP profiles instead of assuming the obsolete single-profile canonical bundle layout."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40978622372
			, failedJobIds: [123831331710]
			, failureCodes: ["ENOENT"]
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} PHP profile repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
