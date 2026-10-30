#!/usr/bin/env node
/**
 * Record the managed diagnostics and WIT local-name repairs.
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
	directProofErasureManagedWitRepairHistoryAdditions
	, directProofErasureManagedWitRepairHistoryPath
	, directProofErasureManagedWitRepairImplementation
	, directProofErasureManagedWitRepairImplementationPaths
	, directProofErasureManagedWitRepairIntegrationPaths
	, directProofErasureManagedWitRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-managed-wit-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-managed-wit-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureManagedWitRepairHistoryPath), false
	, `${directProofErasureManagedWitRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureManagedWitRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureManagedWitRepairImplementation}^`]).trim()
, directProofErasureManagedWitRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureManagedWitRepairPredecessor
	, directProofErasureManagedWitRepairImplementation, "--"])
, [...directProofErasureManagedWitRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureManagedWitRepairPredecessor
	, directProofErasureManagedWitRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureManagedWitRepairImplementation}`
		+ `:${directProofErasureManagedWitRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasureManagedWitRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureManagedWitRepairHistoryAdditions])
, [...directProofErasureManagedWitRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureManagedWitRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureManagedWitRepairPredecessor
		, directProofErasureManagedWitRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-managed-wit-repair-"));
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
	temporaryGit(["read-tree", directProofErasureManagedWitRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureManagedWitRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureManagedWitRepairImplementation
	], { input: "Authenticate proof managed and WIT repairs\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureManagedWitRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureManagedWitRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of directProofErasureManagedWitRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureManagedWitRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-managed-wit-repair-source-v1"
			, predecessorCommit: directProofErasureManagedWitRepairPredecessor
			, implementationCommit: directProofErasureManagedWitRepairImplementation
			, scope: "Allocate collision-free internal WIT callback locals and retain current .NET and Kotlin compiler diagnostics proving erased proof arguments are absent."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40978622372
			, failedJobIds: [123830083085, 123830083116, 123830083150]
			, failureCodes: ["build-command-failed", "ERR_ASSERTION"]
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} managed/WIT repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
