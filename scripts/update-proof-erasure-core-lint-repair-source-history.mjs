#!/usr/bin/env node
/**
 * Record the direct proof-erasure Core lint repair.
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
	proofErasureCoreLintRepairHistoryAdditions
	, proofErasureCoreLintRepairHistoryPath
	, proofErasureCoreLintRepairImplementation
	, proofErasureCoreLintRepairImplementationPaths
	, proofErasureCoreLintRepairIntegrationPaths
	, proofErasureCoreLintRepairPredecessor
} from "../tests/helpers/proof-erasure-core-lint-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-proof-erasure-core-lint-repair-source-history.mjs");
assert.equal(existsSync(proofErasureCoreLintRepairHistoryPath), false
	, `${proofErasureCoreLintRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, proofErasureCoreLintRepairImplementation);
assert.equal(git(["rev-parse"
	, `${proofErasureCoreLintRepairImplementation}^`]).trim()
, proofErasureCoreLintRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, proofErasureCoreLintRepairPredecessor
	, proofErasureCoreLintRepairImplementation, "--"])
, [...proofErasureCoreLintRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, proofErasureCoreLintRepairPredecessor
	, proofErasureCoreLintRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${proofErasureCoreLintRepairImplementation}`
		+ `:${proofErasureCoreLintRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...proofErasureCoreLintRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...proofErasureCoreLintRepairHistoryAdditions])
, [...proofErasureCoreLintRepairHistoryAdditions].sort());

const updates = [];
for(const path of proofErasureCoreLintRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, proofErasureCoreLintRepairPredecessor
		, proofErasureCoreLintRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-proof-erasure-core-lint-repair-"));
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
	temporaryGit(["read-tree", proofErasureCoreLintRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...proofErasureCoreLintRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", proofErasureCoreLintRepairImplementation
	], { input: "Authenticate proof-erasure Core lint repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of proofErasureCoreLintRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, proofErasureCoreLintRepairImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of proofErasureCoreLintRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(proofErasureCoreLintRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "proof-erasure-core-lint-repair-source-v1"
		, predecessorCommit: proofErasureCoreLintRepairPredecessor
		, implementationCommit: proofErasureCoreLintRepairImplementation
		, scope: "Restore the exact repository lint contract for the bounded direct proof-erasure workflow and receipt tests without changing workflow, receipt or type-surface semantics."
		, updates, integrationUpdates, historyAdditions
		, repairedLintErrors: 10, currentSourcePaths: []
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} lint repairs, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
