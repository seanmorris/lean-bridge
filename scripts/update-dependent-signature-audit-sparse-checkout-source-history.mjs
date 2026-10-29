#!/usr/bin/env node
/**
 * Record the dependent-signature audit sparse-checkout transition.
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
	dependentSignatureAuditSparseCheckoutHistoryAdditions
	, dependentSignatureAuditSparseCheckoutHistoryPath
	, dependentSignatureAuditSparseCheckoutImplementation
	, dependentSignatureAuditSparseCheckoutImplementationPaths
	, dependentSignatureAuditSparseCheckoutIntegrationPaths
	, dependentSignatureAuditSparseCheckoutPredecessor
} from "../tests/helpers/dependent-signature-audit-sparse-checkout-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-signature-audit-sparse-checkout-source-history.mjs");
assert.equal(existsSync(dependentSignatureAuditSparseCheckoutHistoryPath), false
	, `${dependentSignatureAuditSparseCheckoutHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentSignatureAuditSparseCheckoutImplementation);
assert.equal(git(["rev-parse"
	, `${dependentSignatureAuditSparseCheckoutImplementation}^`]).trim()
, dependentSignatureAuditSparseCheckoutPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentSignatureAuditSparseCheckoutPredecessor
	, dependentSignatureAuditSparseCheckoutImplementation, "--"])
, [...dependentSignatureAuditSparseCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentSignatureAuditSparseCheckoutPredecessor
	, dependentSignatureAuditSparseCheckoutImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentSignatureAuditSparseCheckoutImplementation}`
		+ `:${dependentSignatureAuditSparseCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dependentSignatureAuditSparseCheckoutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentSignatureAuditSparseCheckoutHistoryAdditions])
, [...dependentSignatureAuditSparseCheckoutHistoryAdditions].sort());

const updates = [];
for(const path of dependentSignatureAuditSparseCheckoutImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, dependentSignatureAuditSparseCheckoutPredecessor
		, dependentSignatureAuditSparseCheckoutImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-signature-audit-sparse-"));
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
	temporaryGit(["read-tree", dependentSignatureAuditSparseCheckoutImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...dependentSignatureAuditSparseCheckoutIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, dependentSignatureAuditSparseCheckoutImplementation
	], { input: "Authenticate dependent-signature audit checkout\n" }).trim();
	const integrationUpdates = [];
	for(const path of dependentSignatureAuditSparseCheckoutIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, dependentSignatureAuditSparseCheckoutImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of dependentSignatureAuditSparseCheckoutHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(dependentSignatureAuditSparseCheckoutHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-signature-audit-sparse-checkout-source-v1"
			, predecessorCommit: dependentSignatureAuditSparseCheckoutPredecessor
			, implementationCommit: dependentSignatureAuditSparseCheckoutImplementation
			, scope: "Retain complete dependent-signature source history while materializing only live source, root evidence records and the selected dependent-signature archive. Exclude unrelated retained payloads without changing either replay or promotion semantics."
			, updates, integrationUpdates, historyAdditions
			, archivePattern: "docs/evidence/dependent-signatures-hosted-*/"
			, fetchDepth: 0, sparseCheckoutConeMode: false
			, currentSourcePaths: []
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} audit transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
