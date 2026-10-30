#!/usr/bin/env node
/**
 * Record the direct proof-erasure PHP profile-contract repair.
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
	directProofErasurePhpProfileContractRepairHistoryAdditions
	, directProofErasurePhpProfileContractRepairHistoryPath
	, directProofErasurePhpProfileContractRepairImplementation
	, directProofErasurePhpProfileContractRepairImplementationPaths
	, directProofErasurePhpProfileContractRepairIntegrationPaths
	, directProofErasurePhpProfileContractRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-php-profile-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-php-profile-contract-repair-source-history.mjs");
assert.equal(existsSync(directProofErasurePhpProfileContractRepairHistoryPath)
	, false, `${directProofErasurePhpProfileContractRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasurePhpProfileContractRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasurePhpProfileContractRepairImplementation}^`]).trim()
, directProofErasurePhpProfileContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasurePhpProfileContractRepairPredecessor
	, directProofErasurePhpProfileContractRepairImplementation, "--"])
, [...directProofErasurePhpProfileContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasurePhpProfileContractRepairPredecessor
	, directProofErasurePhpProfileContractRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasurePhpProfileContractRepairImplementation}`
		+ `:${directProofErasurePhpProfileContractRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasurePhpProfileContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasurePhpProfileContractRepairHistoryAdditions])
, [...directProofErasurePhpProfileContractRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasurePhpProfileContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasurePhpProfileContractRepairPredecessor
		, directProofErasurePhpProfileContractRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-php-profile-contract-repair-"));
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
		, directProofErasurePhpProfileContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasurePhpProfileContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasurePhpProfileContractRepairImplementation
	], { input: "Authenticate proof PHP profile contracts\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasurePhpProfileContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasurePhpProfileContractRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasurePhpProfileContractRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasurePhpProfileContractRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-php-profile-contract-repair-source-v1"
			, predecessorCommit: directProofErasurePhpProfileContractRepairPredecessor
			, implementationCommit: directProofErasurePhpProfileContractRepairImplementation
			, scope: "Validate each direct proof-erasure PHP package against its exact public parameter name and Nat representation: native PHP int and PHP-Wasm Brick Math BigInteger."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40992970885
			, failedJobId: 123872388659
			, failureCode: "ERR_ASSERTION"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} PHP profile-contract repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
