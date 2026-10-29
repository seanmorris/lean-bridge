#!/usr/bin/env node
/**
 * Record the dependent-signature producer sparse-checkout transition.
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
	dependentSignatureProducerSparseCheckoutHistoryAdditions
	, dependentSignatureProducerSparseCheckoutHistoryPath
	, dependentSignatureProducerSparseCheckoutImplementation
	, dependentSignatureProducerSparseCheckoutImplementationPaths
	, dependentSignatureProducerSparseCheckoutIntegrationPaths
	, dependentSignatureProducerSparseCheckoutPredecessor
} from "../tests/helpers/dependent-signature-producer-sparse-checkout-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-signature-producer-sparse-checkout-source-history.mjs");
assert.equal(existsSync(dependentSignatureProducerSparseCheckoutHistoryPath), false
	, `${dependentSignatureProducerSparseCheckoutHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentSignatureProducerSparseCheckoutImplementation);
assert.equal(git(["rev-parse"
	, `${dependentSignatureProducerSparseCheckoutImplementation}^`]).trim()
, dependentSignatureProducerSparseCheckoutPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentSignatureProducerSparseCheckoutPredecessor
	, dependentSignatureProducerSparseCheckoutImplementation, "--"])
, [...dependentSignatureProducerSparseCheckoutImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentSignatureProducerSparseCheckoutPredecessor
	, dependentSignatureProducerSparseCheckoutImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentSignatureProducerSparseCheckoutImplementation}`
		+ `:${dependentSignatureProducerSparseCheckoutHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dependentSignatureProducerSparseCheckoutIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentSignatureProducerSparseCheckoutHistoryAdditions])
, [...dependentSignatureProducerSparseCheckoutHistoryAdditions].sort());

const updates = [];
for(const path of dependentSignatureProducerSparseCheckoutImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, dependentSignatureProducerSparseCheckoutPredecessor
		, dependentSignatureProducerSparseCheckoutImplementation
		, { maximumEditBytes: 16 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-signature-producer-sparse-"));
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
	temporaryGit(["read-tree", dependentSignatureProducerSparseCheckoutImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...dependentSignatureProducerSparseCheckoutIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, dependentSignatureProducerSparseCheckoutImplementation
	], { input: "Authenticate dependent-signature producer sparse checkout\n" }).trim();
	const integrationUpdates = [];
	for(const path of dependentSignatureProducerSparseCheckoutIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, dependentSignatureProducerSparseCheckoutImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of dependentSignatureProducerSparseCheckoutHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(dependentSignatureProducerSparseCheckoutHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-signature-producer-sparse-checkout-source-v1"
			, predecessorCommit: dependentSignatureProducerSparseCheckoutPredecessor
			, implementationCommit: dependentSignatureProducerSparseCheckoutImplementation
			, scope: "Retain all eleven dependent-signature producer source and build inputs while excluding the immutable hosted evidence corpus from each package checkout. Preserve depth-one focused execution, full-history standalone semantics and every acceptance command."
			, updates, integrationUpdates, historyAdditions
			, producerWorkflowCount: 11
			, excludedPattern: "!/docs/evidence/*"
			, retainedEvidencePatterns: [
				"/docs/evidence/*.json", "/docs/evidence/*.md"
				, "/docs/evidence/*.xml"
			]
			, sparseCheckoutConeMode: false, currentSourcePaths: []
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} producer transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
