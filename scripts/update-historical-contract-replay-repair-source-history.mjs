#!/usr/bin/env node
/**
 * Record the historical contract replay repair.
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
	historicalContractReplayRepairHistoryAdditions
	, historicalContractReplayRepairHistoryPath
	, historicalContractReplayRepairImplementation
	, historicalContractReplayRepairImplementationPaths
	, historicalContractReplayRepairIntegrationPaths
	, historicalContractReplayRepairPredecessor
} from "../tests/helpers/historical-contract-replay-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historicalContractReplayRepairHistoryPath), false
	, "Historical replay repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, historicalContractReplayRepairImplementation);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, historicalContractReplayRepairPredecessor
	, historicalContractReplayRepairImplementation, "--"])
, [...historicalContractReplayRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, historicalContractReplayRepairPredecessor
	, historicalContractReplayRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${historicalContractReplayRepairImplementation}:`
		+ historicalContractReplayRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...historicalContractReplayRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historicalContractReplayRepairHistoryAdditions])
, [...historicalContractReplayRepairHistoryAdditions].sort());

const updates = [];
for(const path of historicalContractReplayRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, historicalContractReplayRepairPredecessor
		, historicalContractReplayRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-history-replay-repair-"));
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
		"git", arguments_, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options });
	temporaryGit(["read-tree", historicalContractReplayRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...historicalContractReplayRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, historicalContractReplayRepairImplementation]
	, { input: "Authenticate historical contract replay repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of historicalContractReplayRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, historicalContractReplayRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of historicalContractReplayRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, historicalContractReplayRepairImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(historicalContractReplayRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "historical-contract-replay-repair-source-v1"
		, predecessorCommit: historicalContractReplayRepairPredecessor
		, implementationCommit: historicalContractReplayRepairImplementation
		, scope: "Recover exact recorded source endpoints from authenticated Git history, make historical reversibility tests consume those endpoints instead of current files, preserve retained Rust replay under sparse checkout, and reconstruct the exact predecessor input for the Perl evidence refresh."
		, updates, integrationUpdates, implementationAdditions: []
		, historyAdditions, currentSourcePaths: [], refreshedPins: 0
	}), { flag: "wx" });
	process.stdout.write("Recorded historical contract replay repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
