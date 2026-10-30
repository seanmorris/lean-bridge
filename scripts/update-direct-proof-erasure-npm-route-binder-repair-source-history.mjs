#!/usr/bin/env node
/**
 * Record the direct proof-erasure npm route-binder repair.
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
	directProofErasureNpmRouteBinderRepairHistoryAdditions
	, directProofErasureNpmRouteBinderRepairHistoryPath
	, directProofErasureNpmRouteBinderRepairImplementation
	, directProofErasureNpmRouteBinderRepairImplementationPaths
	, directProofErasureNpmRouteBinderRepairIntegrationPaths
	, directProofErasureNpmRouteBinderRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-npm-route-binder-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-npm-route-binder-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureNpmRouteBinderRepairHistoryPath), false
	, `${directProofErasureNpmRouteBinderRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureNpmRouteBinderRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureNpmRouteBinderRepairImplementation}^`]).trim()
, directProofErasureNpmRouteBinderRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureNpmRouteBinderRepairPredecessor
	, directProofErasureNpmRouteBinderRepairImplementation, "--"])
, [...directProofErasureNpmRouteBinderRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureNpmRouteBinderRepairPredecessor
	, directProofErasureNpmRouteBinderRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureNpmRouteBinderRepairImplementation}`
		+ `:${directProofErasureNpmRouteBinderRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...directProofErasureNpmRouteBinderRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureNpmRouteBinderRepairHistoryAdditions])
, [...directProofErasureNpmRouteBinderRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureNpmRouteBinderRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureNpmRouteBinderRepairPredecessor
		, directProofErasureNpmRouteBinderRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-npm-route-binder-repair-"));
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
		, directProofErasureNpmRouteBinderRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureNpmRouteBinderRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, directProofErasureNpmRouteBinderRepairImplementation
	], { input: "Authenticate proof npm route binders\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureNpmRouteBinderRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureNpmRouteBinderRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasureNpmRouteBinderRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureNpmRouteBinderRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-npm-route-binder-repair-source-v1"
			, predecessorCommit: directProofErasureNpmRouteBinderRepairPredecessor
			, implementationCommit: directProofErasureNpmRouteBinderRepairImplementation
			, scope: "Verify the ordinary npm route with its canonical arg0 binder and the independently reviewed route with its authored value binder, while requiring Binding IR, compiler adapters and generated Lean to agree exactly."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 40986444238
			, failedJobId: 123838738073
			, failureCode: "ERR_ASSERTION"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} npm route-binder repair and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
