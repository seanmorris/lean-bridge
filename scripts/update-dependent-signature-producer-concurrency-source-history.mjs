#!/usr/bin/env node
/**
 * Record the bounded dependent-signature producer graph transition.
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
	dependentSignatureProducerConcurrencyHistoryAdditions
	, dependentSignatureProducerConcurrencyHistoryPath
	, dependentSignatureProducerConcurrencyImplementation
	, dependentSignatureProducerConcurrencyImplementationPaths
	, dependentSignatureProducerConcurrencyIntegrationPaths
	, dependentSignatureProducerConcurrencyPredecessor
} from "../tests/helpers/dependent-signature-producer-concurrency-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-signature-producer-concurrency-source-history.mjs");
assert.equal(existsSync(dependentSignatureProducerConcurrencyHistoryPath), false
	, `${dependentSignatureProducerConcurrencyHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, dependentSignatureProducerConcurrencyImplementation);
assert.equal(git(["rev-parse"
	, `${dependentSignatureProducerConcurrencyImplementation}^`]).trim()
, dependentSignatureProducerConcurrencyPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, dependentSignatureProducerConcurrencyPredecessor
	, dependentSignatureProducerConcurrencyImplementation, "--"])
, [...dependentSignatureProducerConcurrencyImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, dependentSignatureProducerConcurrencyPredecessor
	, dependentSignatureProducerConcurrencyImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${dependentSignatureProducerConcurrencyImplementation}`
		+ `:${dependentSignatureProducerConcurrencyHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...dependentSignatureProducerConcurrencyIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...dependentSignatureProducerConcurrencyHistoryAdditions])
, [...dependentSignatureProducerConcurrencyHistoryAdditions].sort());

const updates = [];
for(const path of dependentSignatureProducerConcurrencyImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, dependentSignatureProducerConcurrencyPredecessor
		, dependentSignatureProducerConcurrencyImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-signature-producer-concurrency-"));
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
	temporaryGit(["read-tree", dependentSignatureProducerConcurrencyImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...dependentSignatureProducerConcurrencyIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, dependentSignatureProducerConcurrencyImplementation
	], { input: "Authenticate bounded dependent-signature producers\n" }).trim();
	const integrationUpdates = [];
	for(const path of dependentSignatureProducerConcurrencyIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, dependentSignatureProducerConcurrencyImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of dependentSignatureProducerConcurrencyHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(dependentSignatureProducerConcurrencyHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "dependent-signature-producer-concurrency-source-v1"
			, predecessorCommit: dependentSignatureProducerConcurrencyPredecessor
			, implementationCommit: dependentSignatureProducerConcurrencyImplementation
			, scope: "Bound eleven dependent-signature producers to three fail-independent chains. Admit at most three concurrent producer jobs while preserving every lane, exact shallow checkout, artifact, receipt dependency and failure observation."
			, updates, integrationUpdates, historyAdditions
			, producerCount: 11, rootProducerCount: 3
			, maximumProducerConcurrency: 3, dependencyCount: 8
			, currentSourcePaths: []
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} producer transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
