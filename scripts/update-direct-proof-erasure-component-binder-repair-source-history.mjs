#!/usr/bin/env node
/**
 * Record the component-side source-binder repair for erased proofs.
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
	directProofErasureComponentBinderRepairHistoryAdditions
	, directProofErasureComponentBinderRepairHistoryPath
	, directProofErasureComponentBinderRepairImplementation
	, directProofErasureComponentBinderRepairImplementationPaths
	, directProofErasureComponentBinderRepairIntegrationPaths
	, directProofErasureComponentBinderRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-component-binder-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-component-binder-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureComponentBinderRepairHistoryPath), false
	, `${directProofErasureComponentBinderRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureComponentBinderRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureComponentBinderRepairImplementation}^`]).trim()
, directProofErasureComponentBinderRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureComponentBinderRepairPredecessor
	, directProofErasureComponentBinderRepairImplementation, "--"])
, [...directProofErasureComponentBinderRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureComponentBinderRepairPredecessor
	, directProofErasureComponentBinderRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureComponentBinderRepairImplementation}`
		+ `:${directProofErasureComponentBinderRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasureComponentBinderRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureComponentBinderRepairHistoryAdditions])
, [...directProofErasureComponentBinderRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureComponentBinderRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureComponentBinderRepairPredecessor
		, directProofErasureComponentBinderRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-component-binder-repair-"));
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
		, directProofErasureComponentBinderRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureComponentBinderRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureComponentBinderRepairImplementation
	], { input: "Authenticate component proof-binder repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureComponentBinderRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureComponentBinderRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of directProofErasureComponentBinderRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureComponentBinderRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-component-binder-repair-source-v1"
			, predecessorCommit: directProofErasureComponentBinderRepairPredecessor
			, implementationCommit: directProofErasureComponentBinderRepairImplementation
			, scope: "Preserve each runtime parameter's elaborated Lean binder identity while converting component types, so erasing a preceding proof cannot rename the remaining host parameter."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40978622372, failedJobId: 123813096267
			, failureCode: "invalid-elaborated-metadata"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} binder repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
