#!/usr/bin/env node
/**
 * Record the direct proof-erasure PHP fact-order repair.
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
	directProofErasurePhpFactOrderRepairHistoryAdditions
	, directProofErasurePhpFactOrderRepairHistoryPath
	, directProofErasurePhpFactOrderRepairImplementation
	, directProofErasurePhpFactOrderRepairImplementationPaths
	, directProofErasurePhpFactOrderRepairIntegrationPaths
	, directProofErasurePhpFactOrderRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-php-fact-order-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-php-fact-order-repair-source-history.mjs");
assert.equal(existsSync(directProofErasurePhpFactOrderRepairHistoryPath), false
	, `${directProofErasurePhpFactOrderRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasurePhpFactOrderRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasurePhpFactOrderRepairImplementation}^`]).trim()
, directProofErasurePhpFactOrderRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasurePhpFactOrderRepairPredecessor
	, directProofErasurePhpFactOrderRepairImplementation, "--"])
, [...directProofErasurePhpFactOrderRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasurePhpFactOrderRepairPredecessor
	, directProofErasurePhpFactOrderRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasurePhpFactOrderRepairImplementation}`
		+ `:${directProofErasurePhpFactOrderRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...directProofErasurePhpFactOrderRepairIntegrationPaths])
, [...directProofErasurePhpFactOrderRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasurePhpFactOrderRepairHistoryAdditions])
, [...directProofErasurePhpFactOrderRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasurePhpFactOrderRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasurePhpFactOrderRepairPredecessor
		, directProofErasurePhpFactOrderRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-php-fact-order-repair-"));
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
	temporaryGit(["read-tree", directProofErasurePhpFactOrderRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasurePhpFactOrderRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", directProofErasurePhpFactOrderRepairImplementation
	], { input: "Authenticate proof PHP fact order\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasurePhpFactOrderRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasurePhpFactOrderRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasurePhpFactOrderRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasurePhpFactOrderRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-php-fact-order-repair-source-v1"
			, predecessorCommit: directProofErasurePhpFactOrderRepairPredecessor
			, implementationCommit:
				directProofErasurePhpFactOrderRepairImplementation
			, scope: "Validate the exact direct proof-erasure PHP build-fact key set independently of JavaScript object insertion order while retaining digest, proof-slot, runtime-parameter and archive checks."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 41000680672, failedJobId: 123897464491
			, failureCode: "ERR_ASSERTION"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} PHP fact-order repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
