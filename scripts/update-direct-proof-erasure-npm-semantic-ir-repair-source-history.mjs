#!/usr/bin/env node
/**
 * Record the direct proof-erasure npm semantic Binding IR repair.
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
	directProofErasureNpmSemanticIrRepairHistoryAdditions
	, directProofErasureNpmSemanticIrRepairHistoryPath
	, directProofErasureNpmSemanticIrRepairImplementation
	, directProofErasureNpmSemanticIrRepairImplementationPaths
	, directProofErasureNpmSemanticIrRepairIntegrationPaths
	, directProofErasureNpmSemanticIrRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-npm-semantic-ir-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-npm-semantic-ir-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureNpmSemanticIrRepairHistoryPath), false
	, `${directProofErasureNpmSemanticIrRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureNpmSemanticIrRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureNpmSemanticIrRepairImplementation}^`]).trim()
, directProofErasureNpmSemanticIrRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureNpmSemanticIrRepairPredecessor
	, directProofErasureNpmSemanticIrRepairImplementation, "--"])
, [...directProofErasureNpmSemanticIrRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureNpmSemanticIrRepairPredecessor
	, directProofErasureNpmSemanticIrRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureNpmSemanticIrRepairImplementation}`
		+ `:${directProofErasureNpmSemanticIrRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...directProofErasureNpmSemanticIrRepairIntegrationPaths])
, [...directProofErasureNpmSemanticIrRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureNpmSemanticIrRepairHistoryAdditions])
, [...directProofErasureNpmSemanticIrRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureNpmSemanticIrRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureNpmSemanticIrRepairPredecessor
		, directProofErasureNpmSemanticIrRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-npm-semantic-ir-repair-"));
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
		, directProofErasureNpmSemanticIrRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureNpmSemanticIrRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureNpmSemanticIrRepairImplementation
	], { input: "Authenticate proof npm semantic IR\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureNpmSemanticIrRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureNpmSemanticIrRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasureNpmSemanticIrRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureNpmSemanticIrRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-npm-semantic-ir-repair-source-v1"
			, predecessorCommit:
				directProofErasureNpmSemanticIrRepairPredecessor
			, implementationCommit:
				directProofErasureNpmSemanticIrRepairImplementation
			, scope: "Retain the semantic Binding IR identity in direct proof-erasure npm build facts, derive it from the verified package receipt, independently recompute it from the retained Binding IR, and reject omitted, altered or extra fact fields."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 41006389958, failedJobId: 123902408087
			, artifactId: 12956701954
			, packageExecutionPassed: true
			, missingField: "bindingIrSha256"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} npm semantic-IR repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
