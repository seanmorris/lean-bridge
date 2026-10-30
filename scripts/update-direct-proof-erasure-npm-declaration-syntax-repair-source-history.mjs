#!/usr/bin/env node
/**
 * Record the direct proof-erasure npm declaration-syntax repair.
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
	directProofErasureNpmDeclarationSyntaxRepairHistoryAdditions
	, directProofErasureNpmDeclarationSyntaxRepairHistoryPath
	, directProofErasureNpmDeclarationSyntaxRepairImplementation
	, directProofErasureNpmDeclarationSyntaxRepairImplementationAdditions
	, directProofErasureNpmDeclarationSyntaxRepairImplementationPaths
	, directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths
	, directProofErasureNpmDeclarationSyntaxRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-npm-declaration-syntax-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-npm-declaration-syntax-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureNpmDeclarationSyntaxRepairHistoryPath)
	, false, `${directProofErasureNpmDeclarationSyntaxRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureNpmDeclarationSyntaxRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureNpmDeclarationSyntaxRepairImplementation}^`]).trim()
, directProofErasureNpmDeclarationSyntaxRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureNpmDeclarationSyntaxRepairPredecessor
	, directProofErasureNpmDeclarationSyntaxRepairImplementation, "--"])
, [...directProofErasureNpmDeclarationSyntaxRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureNpmDeclarationSyntaxRepairPredecessor
	, directProofErasureNpmDeclarationSyntaxRepairImplementation, "--"])
, [...directProofErasureNpmDeclarationSyntaxRepairImplementationAdditions]
	.sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureNpmDeclarationSyntaxRepairImplementation}`
		+ `:${directProofErasureNpmDeclarationSyntaxRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths])
, [...directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureNpmDeclarationSyntaxRepairHistoryAdditions])
, [...directProofErasureNpmDeclarationSyntaxRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureNpmDeclarationSyntaxRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureNpmDeclarationSyntaxRepairPredecessor
		, directProofErasureNpmDeclarationSyntaxRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-npm-declaration-syntax-repair-"));
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
		, directProofErasureNpmDeclarationSyntaxRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureNpmDeclarationSyntaxRepairImplementation
	], { input: "Authenticate proof npm declaration syntax\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureNpmDeclarationSyntaxRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureNpmDeclarationSyntaxRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const implementationAdditions = [];
	for(const path of
		directProofErasureNpmDeclarationSyntaxRepairImplementationAdditions) {
		assert.equal(git(["ls-tree", "--name-only"
			, directProofErasureNpmDeclarationSyntaxRepairPredecessor, "--", path])
			.trim(), "", path);
		implementationAdditions.push({
			path
			, sha256: sha256(git(["show"
				, `${directProofErasureNpmDeclarationSyntaxRepairImplementation}:${path}`]))
		});
		}
	const historyAdditions = [];
	for(const path of directProofErasureNpmDeclarationSyntaxRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureNpmDeclarationSyntaxRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-npm-declaration-syntax-repair-source-v1"
			, predecessorCommit:
				directProofErasureNpmDeclarationSyntaxRepairPredecessor
			, implementationCommit:
				directProofErasureNpmDeclarationSyntaxRepairImplementation
			, scope: "Validate the generated proof-erased npm declaration as TypeScript syntax. Require one proof-free numeric keep parameter and result for the exact author route while allowing truthful explanatory comments."
			, updates, integrationUpdates, implementationAdditions
			, historyAdditions, hostedRunId: 41000680672
			, failedJobId: 123884392892
			, failureCode: "ERR_ASSERTION"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} npm declaration-syntax `
		+ `repairs and ${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
