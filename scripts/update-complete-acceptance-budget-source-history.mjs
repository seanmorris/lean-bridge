#!/usr/bin/env node
/**
 * Record the bounded proof-erasure and HostNull completion workflows.
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
	completeAcceptanceBudgetHistoryAdditions
	, completeAcceptanceBudgetHistoryPath
	, completeAcceptanceBudgetImplementation
	, completeAcceptanceBudgetImplementationPaths
	, completeAcceptanceBudgetIntegrationPaths
	, completeAcceptanceBudgetPredecessor
} from "../tests/helpers/complete-acceptance-budget-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-complete-acceptance-budget-source-history.mjs");
assert.equal(existsSync(completeAcceptanceBudgetHistoryPath), false
	, `${completeAcceptanceBudgetHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, completeAcceptanceBudgetImplementation);
assert.equal(git(["rev-parse", `${completeAcceptanceBudgetImplementation}^`]).trim()
	, completeAcceptanceBudgetPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, completeAcceptanceBudgetPredecessor, completeAcceptanceBudgetImplementation
	, "--"]), [...completeAcceptanceBudgetImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, completeAcceptanceBudgetPredecessor, completeAcceptanceBudgetImplementation
	, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${completeAcceptanceBudgetImplementation}:${completeAcceptanceBudgetHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...completeAcceptanceBudgetIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...completeAcceptanceBudgetHistoryAdditions])
, [...completeAcceptanceBudgetHistoryAdditions].sort());

const updates = [];
for(const path of completeAcceptanceBudgetImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, completeAcceptanceBudgetPredecessor
		, completeAcceptanceBudgetImplementation
		, { maximumEditBytes: 16 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-complete-acceptance-budget-"));
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
	temporaryGit(["read-tree", completeAcceptanceBudgetImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...completeAcceptanceBudgetIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", completeAcceptanceBudgetImplementation
	], { input: "Authenticate complete acceptance budgets\n" }).trim();
	const integrationUpdates = [];
	for(const path of completeAcceptanceBudgetIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, completeAcceptanceBudgetImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of completeAcceptanceBudgetHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(completeAcceptanceBudgetHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "complete-acceptance-budget-source-v1"
		, predecessorCommit: completeAcceptanceBudgetPredecessor
		, implementationCommit: completeAcceptanceBudgetImplementation
		, scope: "Bound direct proof-erasure and HostNull focused producer groups to no more than three internal jobs at once. Retain fail-independent execution and exact receipt reconciliation while excluding unrelated hosted evidence from audit and receipt worktrees."
		, updates, integrationUpdates, historyAdditions
		, proofErasureProducerGroups: 5, hostNullProducerGroups: 4
		, maximumInternalProducerConcurrency: 3
		, auditFetchDepth: 0, receiptFetchDepth: 1
		, sparseCheckoutConeMode: false, currentSourcePaths: []
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} budget transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
