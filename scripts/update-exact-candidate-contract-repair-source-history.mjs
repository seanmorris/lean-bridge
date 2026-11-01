#!/usr/bin/env node
/**
 * Record the exact-candidate CI contract and checkout repair.
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
	exactCandidateContractRepairHistoryAdditions
	, exactCandidateContractRepairHistoryPath
	, exactCandidateContractRepairImplementation
	, exactCandidateContractRepairImplementationPaths
	, exactCandidateContractRepairIntegrationPaths
	, exactCandidateContractRepairPredecessor
} from "../tests/helpers/exact-candidate-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-exact-candidate-contract-repair-source-history.mjs");
assert.equal(existsSync(exactCandidateContractRepairHistoryPath), false
	, `${exactCandidateContractRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, exactCandidateContractRepairImplementation);
assert.equal(git(["rev-parse"
	, `${exactCandidateContractRepairImplementation}^`]).trim(),
exactCandidateContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, exactCandidateContractRepairPredecessor
	, exactCandidateContractRepairImplementation, "--"]),
[...exactCandidateContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, exactCandidateContractRepairPredecessor
	, exactCandidateContractRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${exactCandidateContractRepairImplementation}:${
		exactCandidateContractRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...exactCandidateContractRepairIntegrationPaths]),
[...exactCandidateContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...exactCandidateContractRepairHistoryAdditions]),
[...exactCandidateContractRepairHistoryAdditions].sort());

const updates = [];
for(const path of exactCandidateContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, exactCandidateContractRepairPredecessor
		, exactCandidateContractRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-exact-candidate-repair-"));
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
	temporaryGit(["read-tree", exactCandidateContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...exactCandidateContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", exactCandidateContractRepairImplementation
	], { input: "Authenticate exact-candidate contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of exactCandidateContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, exactCandidateContractRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of exactCandidateContractRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(exactCandidateContractRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "exact-candidate-contract-repair-source-v1"
		, predecessorCommit: exactCandidateContractRepairPredecessor
		, implementationCommit: exactCandidateContractRepairImplementation
		, candidate: {
			commit: "766fd12a6297fe52fe3eeccc77105aacb2f32903"
			, coreRunId: 41242839492, downstreamRunId: 41242839565
			, coreContractFailureJobs: [124667145154, 124667145164]
			, downstreamContractFailureJobs: [
				124662134912, 124662134998, 124662135038
				, 124662135074, 124679799351
			]
			, infrastructureJobs: [
				124662134855, 124662134876, 124662134915
			]
		}
		, validation: {
			perlWorkflowContractTestsPassed: 104
			, focusedHistoryAndSparseTestsPassed: 12
			, reviewedSubtypeTestsPassed: 5
			, perlFinArchiveBeforeMs: 251308, perlFinArchiveAfterMs: 6970
			, perlFinXsBeforeMs: 250989, perlFinXsAfterMs: 7048
			, phpWasmHistoryBeforeObservedMs: 364000
			, phpWasmHistoryBeforeTerminated: true
			, phpWasmHistoryAfterMs: 7756, runtimeSemanticChanges: 0
		}
		, changedSupportCells: 0, sourceContractChanges: 14
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and both exact candidate runs.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
