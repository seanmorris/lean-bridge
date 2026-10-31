#!/usr/bin/env node
/**
 * Record the owned JavaScript checkout-contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	assertOwnedJavaScriptCheckoutContractRepair
	, ownedJavaScriptCheckoutContractRepairAddedPaths
	, ownedJavaScriptCheckoutContractRepairHistoryPath
	, ownedJavaScriptCheckoutContractRepairImplementation
	, ownedJavaScriptCheckoutContractRepairImplementationPaths
	, ownedJavaScriptCheckoutContractRepairIntegrationPaths
	, ownedJavaScriptCheckoutContractRepairPredecessor
} from "../tests/helpers/owned-javascript-checkout-contract-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-owned-javascript-checkout-contract-repair-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, ownedJavaScriptCheckoutContractRepairImplementation
	, "Run at the exact implementation revision");
assert.equal(git(["rev-parse"
	, ownedJavaScriptCheckoutContractRepairImplementation + "^"]).trim()
, ownedJavaScriptCheckoutContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, ownedJavaScriptCheckoutContractRepairPredecessor
	, ownedJavaScriptCheckoutContractRepairImplementation])
, [...ownedJavaScriptCheckoutContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...ownedJavaScriptCheckoutContractRepairIntegrationPaths])
, [...ownedJavaScriptCheckoutContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...ownedJavaScriptCheckoutContractRepairAddedPaths])
, [...ownedJavaScriptCheckoutContractRepairAddedPaths].sort());
assert.equal(existsSync(ownedJavaScriptCheckoutContractRepairHistoryPath)
	, false, ownedJavaScriptCheckoutContractRepairHistoryPath
		+ " already exists");

const recurring = git(["show"
	, ownedJavaScriptCheckoutContractRepairImplementation
	+ ":.github/workflows/consumer-matrix.yml"]);
const scoped = git(["show"
	, ownedJavaScriptCheckoutContractRepairImplementation
	+ ":.github/workflows/owned-checked-record-npm-browser.yml"]);
assertOwnedJavaScriptCheckoutContractRepair(recurring, scoped);
const updates = [];
for(const path of ownedJavaScriptCheckoutContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, ownedJavaScriptCheckoutContractRepairPredecessor
		, ownedJavaScriptCheckoutContractRepairImplementation));

const directory = await mkdtemp(join(
	tmpdir(), "lean-owned-javascript-checkout-repair-"));
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
		, ownedJavaScriptCheckoutContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...ownedJavaScriptCheckoutContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, ownedJavaScriptCheckoutContractRepairImplementation
	], { input: "Authenticate owned JavaScript checkout repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of ownedJavaScriptCheckoutContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, ownedJavaScriptCheckoutContractRepairImplementation
			, integrationCommit));
	const additions = [];
	for(const path of ownedJavaScriptCheckoutContractRepairAddedPaths)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(ownedJavaScriptCheckoutContractRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone:
				"owned-javascript-checkout-contract-repair-source-v1"
			, predecessorCommit:
				ownedJavaScriptCheckoutContractRepairPredecessor
			, implementationCommit:
				ownedJavaScriptCheckoutContractRepairImplementation
			, integrationCommit
			, failedRun: {
				workflow: 41235164345, job: 124638176219
				, headSha:
					ownedJavaScriptCheckoutContractRepairPredecessor
				, test: "CI executes consuming JavaScript packages and rejects skipped checks or missing reports"
			}
			, rootCause: "The recurring owned JavaScript job adopted the required history-aware sparse checkout, but its exact CI-shape assertion and the dedicated owned checked-record npm producer still described the previous complete checkout. The stale assertion rejected correct hosted behavior after all production execution before it had changed any semantic contract."
			, scope: "Bind both recurring and scoped owned JavaScript producers to the same cleanup, complete blobless history and bounded sparse source manifest. Update the exact workflow model and mutation controls for all five checkout fields while retaining every runtime, package, browser, ownership, publication and history gate unchanged."
			, changedSupportCells: 0, semanticChanges: 0
			, localFocusedTests: { passed: 15, failed: 0, skipped: 0 }
			, updates, integrationUpdates, additions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
