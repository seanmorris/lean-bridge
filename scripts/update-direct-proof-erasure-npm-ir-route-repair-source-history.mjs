#!/usr/bin/env node
/**
 * Record the direct proof-erasure npm author-route IR repair.
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
	directProofErasureNpmIrRouteRepairHistoryAdditions
	, directProofErasureNpmIrRouteRepairHistoryPath
	, directProofErasureNpmIrRouteRepairImplementation
	, directProofErasureNpmIrRouteRepairImplementationPaths
	, directProofErasureNpmIrRouteRepairIntegrationPaths
	, directProofErasureNpmIrRouteRepairPredecessor
} from "../tests/helpers/direct-proof-erasure-npm-ir-route-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-direct-proof-erasure-npm-ir-route-repair-source-history.mjs");
assert.equal(existsSync(directProofErasureNpmIrRouteRepairHistoryPath), false
	, `${directProofErasureNpmIrRouteRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, directProofErasureNpmIrRouteRepairImplementation);
assert.equal(git(["rev-parse"
	, `${directProofErasureNpmIrRouteRepairImplementation}^`]).trim()
, directProofErasureNpmIrRouteRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, directProofErasureNpmIrRouteRepairPredecessor
	, directProofErasureNpmIrRouteRepairImplementation, "--"])
, [...directProofErasureNpmIrRouteRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, directProofErasureNpmIrRouteRepairPredecessor
	, directProofErasureNpmIrRouteRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${directProofErasureNpmIrRouteRepairImplementation}`
		+ `:${directProofErasureNpmIrRouteRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...directProofErasureNpmIrRouteRepairIntegrationPaths])
, [...directProofErasureNpmIrRouteRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...directProofErasureNpmIrRouteRepairHistoryAdditions])
, [...directProofErasureNpmIrRouteRepairHistoryAdditions].sort());

const updates = [];
for(const path of directProofErasureNpmIrRouteRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, directProofErasureNpmIrRouteRepairPredecessor
		, directProofErasureNpmIrRouteRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-direct-proof-npm-ir-route-repair-"));
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
	temporaryGit(["read-tree", directProofErasureNpmIrRouteRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...directProofErasureNpmIrRouteRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", directProofErasureNpmIrRouteRepairImplementation
	], { input: "Authenticate proof npm IR author route\n" }).trim();
	const integrationUpdates = [];
	for(const path of directProofErasureNpmIrRouteRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, directProofErasureNpmIrRouteRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of directProofErasureNpmIrRouteRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(directProofErasureNpmIrRouteRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "direct-proof-erasure-npm-ir-route-repair-source-v1"
			, predecessorCommit: directProofErasureNpmIrRouteRepairPredecessor
			, implementationCommit: directProofErasureNpmIrRouteRepairImplementation
			, scope: "Use one exact ordinary/reviewed author-route mapping for retained Binding IR, generated Lean and TypeScript declarations, then replay the original hosted ordinary package and three-browser evidence through the repaired checker."
			, updates, integrationUpdates, historyAdditions
			, hostedRunId: 41006389958, failedJobId: 123902408087
			, artifactId: 12956701954, replayedArtifact: true
			, ordinaryParameter: "arg0", reviewedParameter: "value"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} npm IR-route repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
