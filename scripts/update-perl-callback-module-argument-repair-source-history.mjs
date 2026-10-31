#!/usr/bin/env node
/**
 * Record the exact installed-Perl callback evidence argument repair.
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
	perlCallbackModuleArgumentRepairHistoryAdditions
	, perlCallbackModuleArgumentRepairHistoryPath
	, perlCallbackModuleArgumentRepairImplementation
	, perlCallbackModuleArgumentRepairImplementationPaths
	, perlCallbackModuleArgumentRepairIntegrationPaths
	, perlCallbackModuleArgumentRepairPredecessor
} from "../tests/helpers/perl-callback-module-argument-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-perl-callback-module-argument-repair-source-history.mjs");
assert.equal(existsSync(perlCallbackModuleArgumentRepairHistoryPath), false
	, `${perlCallbackModuleArgumentRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, perlCallbackModuleArgumentRepairImplementation);
assert.equal(git(["rev-parse"
	, `${perlCallbackModuleArgumentRepairImplementation}^`]).trim()
, perlCallbackModuleArgumentRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, perlCallbackModuleArgumentRepairPredecessor
	, perlCallbackModuleArgumentRepairImplementation, "--"])
, [...perlCallbackModuleArgumentRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, perlCallbackModuleArgumentRepairPredecessor
	, perlCallbackModuleArgumentRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${perlCallbackModuleArgumentRepairImplementation}:${
		perlCallbackModuleArgumentRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...perlCallbackModuleArgumentRepairIntegrationPaths])
, [...perlCallbackModuleArgumentRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...perlCallbackModuleArgumentRepairHistoryAdditions])
, [...perlCallbackModuleArgumentRepairHistoryAdditions].sort());

const updates = [];
for(const path of perlCallbackModuleArgumentRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, perlCallbackModuleArgumentRepairPredecessor
		, perlCallbackModuleArgumentRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-perl-module-argument-"));
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
	temporaryGit(["read-tree", perlCallbackModuleArgumentRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...perlCallbackModuleArgumentRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", perlCallbackModuleArgumentRepairImplementation
	], { input: "Authenticate Perl callback module arguments\n" }).trim();
	const integrationUpdates = [];
	for(const path of perlCallbackModuleArgumentRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, perlCallbackModuleArgumentRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of perlCallbackModuleArgumentRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(perlCallbackModuleArgumentRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "perl-callback-module-argument-repair-source-v1"
		, predecessorCommit: perlCallbackModuleArgumentRepairPredecessor
		, implementationCommit: perlCallbackModuleArgumentRepairImplementation
		, hostedFailure: {
			runId: 41242839565, jobId: 124662134912
			, artifactId: 13062220600
			, logSha256: "b05a501f10bdb9999801667edfefb8c4039e625017cc7ed91db701efa0fb1663"
			, tests: 16, passed: 12, failed: 4
			, unexpectedArgument: "LeanBridge::OwnedProbe"
		}
		, validation: {
			hostedRuntimeTestsPassed: 41
			, affectedReconstructionTestsPassed: 4
			, optionalPackageForgeriesRejected: 438
			, runtimeSemanticChanges: 0
		}
		, changedSupportCells: 0, evidenceContractChanges: 2
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and the exact hosted failure.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
