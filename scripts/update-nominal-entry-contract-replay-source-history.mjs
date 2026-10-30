#!/usr/bin/env node
/**
 * Record the exact nominal-entry historical-contract replay repair.
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
	nominalEntryContractReplayHistoryAdditions
	, nominalEntryContractReplayHistoryPath
	, nominalEntryContractReplayImplementation
	, nominalEntryContractReplayImplementationPaths
	, nominalEntryContractReplayIntegrationPaths
	, nominalEntryContractReplayPredecessor
} from "../tests/helpers/nominal-entry-contract-replay-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-nominal-entry-contract-replay-source-history.mjs");
assert.equal(existsSync(nominalEntryContractReplayHistoryPath), false
	, `${nominalEntryContractReplayHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, nominalEntryContractReplayImplementation);
assert.equal(git(["rev-parse"
	, `${nominalEntryContractReplayImplementation}^`]).trim()
, nominalEntryContractReplayPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, nominalEntryContractReplayPredecessor
	, nominalEntryContractReplayImplementation, "--"])
, [...nominalEntryContractReplayImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, nominalEntryContractReplayPredecessor
	, nominalEntryContractReplayImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${nominalEntryContractReplayImplementation}:${
		nominalEntryContractReplayHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...nominalEntryContractReplayIntegrationPaths])
, [...nominalEntryContractReplayIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...nominalEntryContractReplayHistoryAdditions])
, [...nominalEntryContractReplayHistoryAdditions].sort());

const updates = [];
for(const path of nominalEntryContractReplayImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, nominalEntryContractReplayPredecessor
		, nominalEntryContractReplayImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-nominal-entry-replay-"));
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
	temporaryGit(["read-tree", nominalEntryContractReplayImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...nominalEntryContractReplayIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", nominalEntryContractReplayImplementation
	], { input: "Authenticate nominal-entry contract replay\n" }).trim();
	const integrationUpdates = [];
	for(const path of nominalEntryContractReplayIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, nominalEntryContractReplayImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of nominalEntryContractReplayHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(nominalEntryContractReplayHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "nominal-entry-contract-replay-source-v1"
		, predecessorCommit: nominalEntryContractReplayPredecessor
		, implementationCommit: nominalEntryContractReplayImplementation
		, diagnosticCoreRun: 41117023757
		, detectedDuringNodeReadback: true
		, repairs: [
			"historical-binding-ir-and-consumer-contract"
			, "exact-source-history-milestone"
			, "publication-time-addition-identity"
		]
		, scope: "Replay nominal-entry measurement and publication history against the exact Binding IR schema, consumer contract, source milestone, and publication identity that each immutable record names. Preserve all support observations and immutable evidence. Missing local archive payloads remain a sparse-checkout condition handled by Core shard materialization rather than a passing test rewrite."
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and three replay repairs.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
