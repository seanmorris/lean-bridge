#!/usr/bin/env node
/**
 * Record the reviewed Fin selected-job evidence boundary.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition } from "../tests/helpers/source-history-stream.mjs";
import {
	reviewedFinJobScopeAddedPaths
	, reviewedFinJobScopeHistoryPath
	, reviewedFinJobScopeImplementation
	, reviewedFinJobScopeImplementationAddedPaths
	, reviewedFinJobScopeImplementationPaths
	, reviewedFinJobScopeIntegrationAddedPaths
	, reviewedFinJobScopeIntegrationPaths
	, reviewedFinJobScopePredecessor
} from "../tests/helpers/reviewed-fin-job-scope-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 ** 2 });
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const integration = git(["rev-parse", "HEAD"]).trim();
assert.equal(git(["rev-parse", `${reviewedFinJobScopeImplementation}^`]).trim()
	, reviewedFinJobScopePredecessor);
assert.equal(git(["rev-parse", `${integration}^`]).trim()
	, reviewedFinJobScopeImplementation);
assert.deepEqual(names(["diff", "--name-only", reviewedFinJobScopePredecessor
	, reviewedFinJobScopeImplementation]), [
	...reviewedFinJobScopeImplementationAddedPaths
	, ...reviewedFinJobScopeImplementationPaths
	].sort());
assert.deepEqual(names(["diff", "--name-only"
	, reviewedFinJobScopeImplementation, integration]), [
	...reviewedFinJobScopeIntegrationAddedPaths
	, ...reviewedFinJobScopeIntegrationPaths
	].sort());
assert.equal(git(["ls-tree", "--name-only", "HEAD", "--"
	, reviewedFinJobScopeHistoryPath]).trim(), "");
assert.equal(git(["status", "--short"]).trim(), "");

const updates = [];
for(const path of reviewedFinJobScopeImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, reviewedFinJobScopePredecessor, reviewedFinJobScopeImplementation));
const integrationUpdates = [];
for(const path of reviewedFinJobScopeIntegrationPaths)
	integrationUpdates.push(await gitSourceHistoryTransition(path
		, reviewedFinJobScopeImplementation, integration));
const additions = reviewedFinJobScopeAddedPaths.map(path => ({
	path, currentSha256: sha256(git(["show", `${integration}:${path}`]))
}));
await writeFile(reviewedFinJobScopeHistoryPath, canonicalJson({
	schemaVersion: 1
	, milestone: "reviewed-fin-job-scope-source-v1"
	, predecessorCommit: reviewedFinJobScopePredecessor
	, implementationCommit: reviewedFinJobScopeImplementation
	, integrationCommit: integration
	, scope: "Authenticate the exact successful reviewed-Fin original and probe jobs and their independently replayed artifacts without coupling those results to unrelated jobs in the enclosing Downstream matrix. Require the run to be terminal with a success, failure or cancelled conclusion; retain that conclusion per evidence leg; continue to require each selected job itself to complete successfully. Claim no result from another matrix job."
	, additions, updates, integrationUpdates
}), { flag: "wx" });
process.stdout.write(`Recorded ${updates.length} implementation and `
	+ `${integrationUpdates.length} integration updates.\n`);
