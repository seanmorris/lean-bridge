#!/usr/bin/env node
/**
 * Record the fresh reviewed-source timeout-budget repair.
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
	assertReviewedSourceTimeoutBudget
	, reviewedSourceTimeoutBudgetHistoryAdditions
	, reviewedSourceTimeoutBudgetHistoryPath
	, reviewedSourceTimeoutBudgetImplementation
	, reviewedSourceTimeoutBudgetImplementationPaths
	, reviewedSourceTimeoutBudgetIntegrationPaths
	, reviewedSourceTimeoutBudgetPredecessor
} from "../tests/helpers/reviewed-source-timeout-budget-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-reviewed-source-timeout-budget-source-history.mjs");
assert.equal(existsSync(reviewedSourceTimeoutBudgetHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, reviewedSourceTimeoutBudgetImplementation);
assert.equal(git(["rev-parse"
	, `${reviewedSourceTimeoutBudgetImplementation}^`]).trim()
, reviewedSourceTimeoutBudgetPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, reviewedSourceTimeoutBudgetPredecessor
	, reviewedSourceTimeoutBudgetImplementation, "--"])
, [...reviewedSourceTimeoutBudgetImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...reviewedSourceTimeoutBudgetIntegrationPaths])
, [...reviewedSourceTimeoutBudgetIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...reviewedSourceTimeoutBudgetHistoryAdditions])
, [...reviewedSourceTimeoutBudgetHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${reviewedSourceTimeoutBudgetImplementation}:${
		reviewedSourceTimeoutBudgetHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSource = path => git(["show"
	, `${reviewedSourceTimeoutBudgetImplementation}:${path}`]);
assertReviewedSourceTimeoutBudget(implementationSource(
	reviewedSourceTimeoutBudgetImplementationPaths[0]));

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	reviewedSourceTimeoutBudgetPredecessor
	, reviewedSourceTimeoutBudgetImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of reviewedSourceTimeoutBudgetImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, reviewedSourceTimeoutBudgetPredecessor
		, reviewedSourceTimeoutBudgetImplementation));

const directory = await mkdtemp(join(
	tmpdir(), "lean-reviewed-source-timeout-history-"));
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
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", reviewedSourceTimeoutBudgetImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...reviewedSourceTimeoutBudgetIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", reviewedSourceTimeoutBudgetImplementation
	], { input: "Authenticate reviewed-source timeout budget\n" }).trim();
	const integrationUpdates = [];
	for(const path of reviewedSourceTimeoutBudgetIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, reviewedSourceTimeoutBudgetImplementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of reviewedSourceTimeoutBudgetHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(reviewedSourceTimeoutBudgetHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "reviewed-source-timeout-budget-v1"
		, predecessorCommit: reviewedSourceTimeoutBudgetPredecessor
		, implementationCommit: reviewedSourceTimeoutBudgetImplementation
		, integrationCommit
		, discovery: {
			run: 41285158941, job: 124789859338
			, test: "fresh Lean checks review identities, record layouts, selection and drift before linking"
			, priorSuccessMilliseconds: 170649.192996
			, hostedTimeoutMilliseconds: 180003.32307
			, localTimeoutMilliseconds: 180041.433069
		}
		, rootCause: "The test performs eight independent fresh Lean elaborations. Its immediately preceding hosted success consumed 94.8% of the fixed 180-second budget, leaving less than ten seconds for ordinary runner variance. The exact candidate and a local one-CPU reproduction both reached the same hard timeout after all earlier semantic checks passed."
		, repair: {
			previousTimeoutMilliseconds: 180000
			, timeoutMilliseconds: 300000, refusalVariants: 8
			, localPassMilliseconds: 188608.836624
		}
		, exactModel: {
			sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "reviewed-source timeout budget.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
