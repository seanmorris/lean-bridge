#!/usr/bin/env node
/**
 * Record the direct proof-erasure npm declaration route-name repair.
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
	directProofErasureNpmDeclarationRouteRepairHistoryAdditions
	, directProofErasureNpmDeclarationRouteRepairHistoryPath
	, directProofErasureNpmDeclarationRouteRepairImplementation
	, directProofErasureNpmDeclarationRouteRepairImplementationPaths
	, directProofErasureNpmDeclarationRouteRepairIntegrationPaths
	, directProofErasureNpmDeclarationRouteRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-npm-declaration-route-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-npm-declaration-route-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureNpmDeclarationRouteRepairHistoryPath)
	, false, `${directProofErasureNpmDeclarationRouteRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureNpmDeclarationRouteRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureNpmDeclarationRouteRepairImplementation}^`]).trim()
, directProofErasureNpmDeclarationRouteRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureNpmDeclarationRouteRepairPredecessor
	, directProofErasureNpmDeclarationRouteRepairImplementation, "--"])
, [...directProofErasureNpmDeclarationRouteRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureNpmDeclarationRouteRepairPredecessor
	, directProofErasureNpmDeclarationRouteRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureNpmDeclarationRouteRepairImplementation}`
		+ `:${directProofErasureNpmDeclarationRouteRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasureNpmDeclarationRouteRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureNpmDeclarationRouteRepairHistoryAdditions])
, [...directProofErasureNpmDeclarationRouteRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureNpmDeclarationRouteRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureNpmDeclarationRouteRepairPredecessor
		, directProofErasureNpmDeclarationRouteRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-npm-declaration-route-repair-"));
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
		, directProofErasureNpmDeclarationRouteRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureNpmDeclarationRouteRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureNpmDeclarationRouteRepairImplementation
	], { input: "Authenticate proof npm declaration route repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureNpmDeclarationRouteRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureNpmDeclarationRouteRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasureNpmDeclarationRouteRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureNpmDeclarationRouteRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-npm-declaration-route-repair-source-v1"
			, predecessorCommit: directProofErasureNpmDeclarationRouteRepairPredecessor
			, implementationCommit: directProofErasureNpmDeclarationRouteRepairImplementation
			, scope: "Require generated npm declarations to retain the ordinary Binding IR parameter name arg0 and the reviewed-source parameter name value, without weakening proof-erasure checks."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40992970885
			, failedJobId: 123859733407
			, failureCode: "ERR_ASSERTION"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} npm declaration repair and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
