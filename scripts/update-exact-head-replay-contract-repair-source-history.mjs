#!/usr/bin/env node
/**
 * Record the exact-head Core and Native PHP replay contract repairs.
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
	assertExactHeadReplayContractRepair
	, exactHeadReplayContractRepairHistoryAdditions
	, exactHeadReplayContractRepairHistoryPath
	, exactHeadReplayContractRepairImplementation
	, exactHeadReplayContractRepairImplementationPaths
	, exactHeadReplayContractRepairIntegrationPaths
	, exactHeadReplayContractRepairPredecessor
} from "../tests/helpers/exact-head-replay-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-exact-head-replay-contract-repair-source-history.mjs");
assert.equal(existsSync(exactHeadReplayContractRepairHistoryPath), false
	, "Exact-head replay contract repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, exactHeadReplayContractRepairImplementation);
assert.equal(git(["rev-parse"
	, `${exactHeadReplayContractRepairImplementation}^`]).trim()
, exactHeadReplayContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, exactHeadReplayContractRepairPredecessor
	, exactHeadReplayContractRepairImplementation, "--"])
, [...exactHeadReplayContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...exactHeadReplayContractRepairIntegrationPaths])
, [...exactHeadReplayContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...exactHeadReplayContractRepairHistoryAdditions])
, [...exactHeadReplayContractRepairHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${exactHeadReplayContractRepairImplementation}:${
		exactHeadReplayContractRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSources = Object.fromEntries(
	exactHeadReplayContractRepairImplementationPaths.map(path => [path
		, git(["show"
			, `${exactHeadReplayContractRepairImplementation}:${path}`])])
);
assert.deepEqual(assertExactHeadReplayContractRepair(implementationSources), {
	livePinRefreshes: 1, changedSupportCells: 0
});

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	exactHeadReplayContractRepairPredecessor
	, exactHeadReplayContractRepairImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactModels[0]);

const updates = [];
for(const path of exactHeadReplayContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, exactHeadReplayContractRepairPredecessor
		, exactHeadReplayContractRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-exact-head-replay-contract-repair-"));
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
	temporaryGit(["read-tree", exactHeadReplayContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...exactHeadReplayContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", exactHeadReplayContractRepairImplementation
	], { input: "Authenticate exact-head replay contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of exactHeadReplayContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, exactHeadReplayContractRepairImplementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of exactHeadReplayContractRepairHistoryAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${exactHeadReplayContractRepairImplementation}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(exactHeadReplayContractRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "exact-head-replay-contract-repair-source-v1"
		, predecessorCommit: exactHeadReplayContractRepairPredecessor
		, implementationCommit: exactHeadReplayContractRepairImplementation
		, integrationCommit
		, discovery: [
			{ run: 41353878183, job: 124999140853
				, lane: "Core contract shard 5/12"
				, observed: "Two stale C-family gate assertions and two pre-field Wasm archive mismatches" }
			, { run: 41353878302, job: 124996984188
				, lane: "Native PHP"
				, observed: "The recursive ownership probe called the current private borrow helper without its recovery argument" }
		]
		, rootCause: "The C-family refusal test matched a closed two-clause substring after later mandatory gates were appended. The Wasm refusal authenticator used current field-aware builders for a deliberately pre-field archive even though dedicated historical reconstructors already existed. The PHP ownership probe did not follow the later explicit callback-recovery parameter."
		, repair: "Parse the C-family failure group and require its refusal clauses without forbidding later gates. Authenticate the immutable Wasm archive through all three pre-field reconstructors. Pass an explicit null recovery pointer in the valid-result PHP ownership probe and advance its sole live source citation."
		, exactModel: { sha256: sha256(exactModels[0])
			, bytes: Buffer.byteLength(exactModels[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries }
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, livePinRefreshes: 1
		, validation: {
			wasmArchive: "6/6 archive and mutation contracts passed"
			, phpModel: "24/24 focused PHP and native model contracts passed"
			, hostedReplacementRequired: true
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "exact-head replay contract repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
