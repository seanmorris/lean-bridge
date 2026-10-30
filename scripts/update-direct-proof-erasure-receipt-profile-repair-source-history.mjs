#!/usr/bin/env node
/**
 * Record the direct proof-erasure managed receipt-profile repair.
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
	directProofErasureReceiptProfileRepairHistoryAdditions
	, directProofErasureReceiptProfileRepairHistoryPath
	, directProofErasureReceiptProfileRepairImplementation
	, directProofErasureReceiptProfileRepairImplementationPaths
	, directProofErasureReceiptProfileRepairIntegrationPaths
	, directProofErasureReceiptProfileRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-receipt-profile-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-receipt-profile-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureReceiptProfileRepairHistoryPath), false
	, `${directProofErasureReceiptProfileRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureReceiptProfileRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureReceiptProfileRepairImplementation}^`]).trim()
, directProofErasureReceiptProfileRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureReceiptProfileRepairPredecessor
	, directProofErasureReceiptProfileRepairImplementation, "--"])
, [...directProofErasureReceiptProfileRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureReceiptProfileRepairPredecessor
	, directProofErasureReceiptProfileRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureReceiptProfileRepairImplementation}`
		+ `:${directProofErasureReceiptProfileRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...directProofErasureReceiptProfileRepairIntegrationPaths])
, [...directProofErasureReceiptProfileRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureReceiptProfileRepairHistoryAdditions])
, [...directProofErasureReceiptProfileRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureReceiptProfileRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureReceiptProfileRepairPredecessor
		, directProofErasureReceiptProfileRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-receipt-profile-repair-"));
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
		, directProofErasureReceiptProfileRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureReceiptProfileRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureReceiptProfileRepairImplementation
	], { input: "Authenticate managed proof receipt profiles\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureReceiptProfileRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureReceiptProfileRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasureReceiptProfileRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureReceiptProfileRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-receipt-profile-repair-source-v1"
			, predecessorCommit: directProofErasureReceiptProfileRepairPredecessor
			, implementationCommit:
				directProofErasureReceiptProfileRepairImplementation
			, scope: "Authenticate the exact closed profile list already emitted beside each managed proof-erasure receipt group, and reject omitted or narrowed managed coverage before same-run aggregation."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 41011134514, failedJobId: 123944202063
			, managedProfilesAuthenticated: true
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} receipt-profile repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
