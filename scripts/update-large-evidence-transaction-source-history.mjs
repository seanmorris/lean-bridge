#!/usr/bin/env node
/**
 * Record copy-free transactional publication for large evidence archives.
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
import {
	largeEvidenceTransactionHistoryAdditions as historyAdditions
	, largeEvidenceTransactionHistoryPath as historyPath
	, largeEvidenceTransactionImplementation as implementation
	, largeEvidenceTransactionImplementationAdditions as implementationAdditions
	, largeEvidenceTransactionImplementationPaths as implementationPaths
	, largeEvidenceTransactionIntegrationPaths as integrationPaths
	, largeEvidenceTransactionPredecessor as predecessor
} from "../tests/helpers/large-evidence-transaction-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-large-evidence-transaction-source-history.mjs");
assert.equal(existsSync(historyPath), false, `${historyPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), [...implementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 16 * 1024 * 1024 }));
const implementationSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));
const directory = await mkdtemp(join(tmpdir(), "lean-large-evidence-history-"));
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate large evidence transactions\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "large-evidence-transaction-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, scope: "Publish dependent-signature and direct proof-erasure archives from one validated sibling staging tree with an inode-preserving rename. Remove the ext4 input-to-staging-to-destination duplicate while preserving absent-destination, clean-source, complete-byte validation, abort cleanup and collision refusal contracts."
		, updates, implementationAdditions: implementationSources
		, integrationUpdates, historyAdditions: additions
		, optimizedArchivers: 2, transactionTests: 3
		, currentSourcePaths: []
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} transaction transitions, `
		+ `${implementationSources.length} additions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
