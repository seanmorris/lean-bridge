#!/usr/bin/env node
/**
 * Record isolation of historical Core profiles from the live cost planner.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertVo1220HistoricalCoreProfileIsolation
	, vo1220HistoricalCoreProfileIsolationBehavior as behavior
	, vo1220HistoricalCoreProfileIsolationHistoryAdditions as historyAdditions
	, vo1220HistoricalCoreProfileIsolationHistoryPath as historyPath
	, vo1220HistoricalCoreProfileIsolationImplementation as implementation
	, vo1220HistoricalCoreProfileIsolationImplementationPaths as implementationPaths
	, vo1220HistoricalCoreProfileIsolationIntegrationPaths as integrationPaths
	, vo1220HistoricalCoreProfileIsolationPredecessor as predecessor
} from "../tests/helpers/vo1220-historical-core-profile-isolation-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220HistoricalCoreProfileIsolation(sources)
	, { ...behavior, historicalContractFiles:
		[...behavior.historicalContractFiles] });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-historical-core-profile-isolation-"));
try
{
	assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...integrationPaths]), [...integrationPaths].sort());
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate historical Core profile isolation\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({
			path, sha256: sha256(await readFile(path))
		});
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-historical-core-profile-isolation-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			coreRun: 42760203921, coreJob: 129651120992
			, tests: 1830, passed: 1687, failed: 2, skipped: 141
			, failedTests: [
				"final Core test repair closes all nine registrations and 102 pins"
				, "final-audit registration closes its profile, preflight and live pins"
			]
			, staleCostRows: [30, 29]
			, shardDurationMs: 15700982.394272
		}
		, rootCause: "Two historical registration checks reconstructed 1,093-file and 1,094-file Core profiles, then passed them to the current cost-balanced planner. The live 1,123-file cost manifest correctly rejected its 30 and 29 newer paths as outside those historical profiles. The evidence records store only the canonical historical contract-set digest and predate the cost-balanced planner."
		, repair: "Hash each reconstructed historical profile with the same canonical contract-set representation recorded by its milestone. Do not apply the live checkout's cost manifest or current partition policy to historical profiles. Scan every helper that reconstructs a profile from git ls-tree and reject any remaining live-planner dependency."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, validation: {
			focusedHistoricalProfiles: {
				tests: 10, passed: 10, failed: 0, durationMs: 13145.122089
			}
			, syntax: "passed", eslint: "passed", diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${historyAdditionRecords.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
