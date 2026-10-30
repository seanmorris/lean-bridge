#!/usr/bin/env node
/**
 * Record the direct proof-erasure PHP receipt-identity repair.
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
	directProofErasurePhpReceiptIdentityRepairHistoryAdditions
	, directProofErasurePhpReceiptIdentityRepairHistoryPath
	, directProofErasurePhpReceiptIdentityRepairImplementation
	, directProofErasurePhpReceiptIdentityRepairImplementationPaths
	, directProofErasurePhpReceiptIdentityRepairIntegrationPaths
	, directProofErasurePhpReceiptIdentityRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-php-receipt-identity-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-php-receipt-identity-repair-source-history.mjs");
assert.equal(existsSync(directProofErasurePhpReceiptIdentityRepairHistoryPath)
	, false, `${directProofErasurePhpReceiptIdentityRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasurePhpReceiptIdentityRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasurePhpReceiptIdentityRepairImplementation}^`]).trim()
, directProofErasurePhpReceiptIdentityRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasurePhpReceiptIdentityRepairPredecessor
	, directProofErasurePhpReceiptIdentityRepairImplementation, "--"])
, [...directProofErasurePhpReceiptIdentityRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasurePhpReceiptIdentityRepairPredecessor
	, directProofErasurePhpReceiptIdentityRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasurePhpReceiptIdentityRepairImplementation}`
		+ `:${directProofErasurePhpReceiptIdentityRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasurePhpReceiptIdentityRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasurePhpReceiptIdentityRepairHistoryAdditions])
, [...directProofErasurePhpReceiptIdentityRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasurePhpReceiptIdentityRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasurePhpReceiptIdentityRepairPredecessor
		, directProofErasurePhpReceiptIdentityRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-php-receipt-identity-repair-"));
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
		, directProofErasurePhpReceiptIdentityRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasurePhpReceiptIdentityRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasurePhpReceiptIdentityRepairImplementation
	], { input: "Authenticate proof PHP receipt identity repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasurePhpReceiptIdentityRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasurePhpReceiptIdentityRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasurePhpReceiptIdentityRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasurePhpReceiptIdentityRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-php-receipt-identity-repair-source-v1"
			, predecessorCommit: directProofErasurePhpReceiptIdentityRepairPredecessor
			, implementationCommit: directProofErasurePhpReceiptIdentityRepairImplementation
			, scope: "Verify native component receipts in the Lean declaration domain and PHP-Wasm copied-component receipts in the Binding IR domain, without accepting an ambiguous fallback name."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40986444238
			, failedJobId: 123853047291
			, failureCode: "ERR_ASSERTION"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} PHP receipt repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
