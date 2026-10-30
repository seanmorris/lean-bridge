#!/usr/bin/env node
/**
 * Record the proof-erasure partition audit repair.
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
	proofErasurePartitionAuditRepairHistoryAdditions
	, proofErasurePartitionAuditRepairHistoryPath
	, proofErasurePartitionAuditRepairImplementation
	, proofErasurePartitionAuditRepairImplementationPaths
	, proofErasurePartitionAuditRepairIntegrationPaths
	, proofErasurePartitionAuditRepairPredecessor
} from "../tests/helpers/proof-erasure-partition-audit-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-proof-erasure-partition-audit-repair-source-history.mjs");
assert.equal(existsSync(proofErasurePartitionAuditRepairHistoryPath), false
	, `${proofErasurePartitionAuditRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, proofErasurePartitionAuditRepairImplementation);
assert.equal(git(["rev-parse"
	, `${proofErasurePartitionAuditRepairImplementation}^`]).trim()
, proofErasurePartitionAuditRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, proofErasurePartitionAuditRepairPredecessor
	, proofErasurePartitionAuditRepairImplementation, "--"])
, [...proofErasurePartitionAuditRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, proofErasurePartitionAuditRepairPredecessor
	, proofErasurePartitionAuditRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${proofErasurePartitionAuditRepairImplementation}`
		+ `:${proofErasurePartitionAuditRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...proofErasurePartitionAuditRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...proofErasurePartitionAuditRepairHistoryAdditions])
, [...proofErasurePartitionAuditRepairHistoryAdditions].sort());

const updates = [];
for(const path of proofErasurePartitionAuditRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, proofErasurePartitionAuditRepairPredecessor
		, proofErasurePartitionAuditRepairImplementation
		, { maximumEditBytes: 16 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-proof-erasure-partition-audit-repair-"));
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
	temporaryGit(["read-tree", proofErasurePartitionAuditRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...proofErasurePartitionAuditRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", proofErasurePartitionAuditRepairImplementation
	], { input: "Authenticate proof partition audit repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of proofErasurePartitionAuditRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, proofErasurePartitionAuditRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of proofErasurePartitionAuditRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(proofErasurePartitionAuditRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "proof-erasure-partition-audit-repair-source-v1"
			, predecessorCommit: proofErasurePartitionAuditRepairPredecessor
			, implementationCommit: proofErasurePartitionAuditRepairImplementation
			, scope: "Bind complete optional-parameter promotion tests to their immutable pre-promotion inventory and documentation, and unwind the newest proof-erasure repair before older Fin-history transitions."
			, updates, integrationUpdates, historyAdditions
			, partition: "tests/checked-javascript-partition-11.test.mjs"
			, repairedTests: [
				"complete optional-parameter promotion changes only exact cells"
				, "complete optional-parameter promotion refuses partial and overlap"
				, "global Fin history reaches both WIT/lint branch parents"
				, "complete optional-parameter docs state the exact omission boundary"
				, "complete optional-parameter docs reject missing and repeated markers"
			]
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} partition audit repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
