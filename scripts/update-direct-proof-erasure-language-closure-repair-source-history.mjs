#!/usr/bin/env node
/**
 * Record the exact language-closure checker repair.
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
	directProofErasureLanguageClosureRepairHistoryAdditions
	, directProofErasureLanguageClosureRepairHistoryPath
	, directProofErasureLanguageClosureRepairImplementation
	, directProofErasureLanguageClosureRepairImplementationPaths
	, directProofErasureLanguageClosureRepairIntegrationPaths
	, directProofErasureLanguageClosureRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-language-closure-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-language-closure-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureLanguageClosureRepairHistoryPath), false
	, `${directProofErasureLanguageClosureRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureLanguageClosureRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureLanguageClosureRepairImplementation}^`]).trim()
, directProofErasureLanguageClosureRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureLanguageClosureRepairPredecessor
	, directProofErasureLanguageClosureRepairImplementation, "--"])
, [...directProofErasureLanguageClosureRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureLanguageClosureRepairPredecessor
	, directProofErasureLanguageClosureRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureLanguageClosureRepairImplementation}`
		+ `:${directProofErasureLanguageClosureRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasureLanguageClosureRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureLanguageClosureRepairHistoryAdditions])
, [...directProofErasureLanguageClosureRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureLanguageClosureRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureLanguageClosureRepairPredecessor
		, directProofErasureLanguageClosureRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-language-closure-repair-"));
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
		, directProofErasureLanguageClosureRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureLanguageClosureRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureLanguageClosureRepairImplementation
	], { input: "Authenticate proof language-closure repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureLanguageClosureRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureLanguageClosureRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of directProofErasureLanguageClosureRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureLanguageClosureRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-language-closure-repair-source-v1"
			, predecessorCommit: directProofErasureLanguageClosureRepairPredecessor
			, implementationCommit: directProofErasureLanguageClosureRepairImplementation
			, scope: "Validate each retained language closure against its exact schema while preserving Python's non-digest interpreter version identity."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40978622372, failedJobId: 123827757645
			, profile: "python", failureCode: "ERR_ASSERTION"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} closure repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
