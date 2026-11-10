#!/usr/bin/env node
/**
 * Record the legacy Perl callback asset-expectation repair.
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
	assertVo1220PerlCallbackAssetExpectationRepair
	, vo1220PerlCallbackAssetExpectationRepairBehavior as behavior
	, vo1220PerlCallbackAssetExpectationRepairHistoryAdditions as historyAdditions
	, vo1220PerlCallbackAssetExpectationRepairHistoryPath as historyPath
	, vo1220PerlCallbackAssetExpectationRepairImplementation as implementation
	, vo1220PerlCallbackAssetExpectationRepairImplementationPaths as implementationPaths
	, vo1220PerlCallbackAssetExpectationRepairIntegrationPaths as integrationPaths
	, vo1220PerlCallbackAssetExpectationRepairPredecessor as predecessor
} from "../tests/helpers/vo1220-perl-callback-asset-expectation-repair-source-history.mjs";

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
assert.deepEqual(assertVo1220PerlCallbackAssetExpectationRepair(sources)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-perl-callback-asset-expectation-"));
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
	], { input: "Authenticate Perl callback asset expectations\n" }).trim();
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
		, milestone:
			"vo1220-perl-callback-asset-expectation-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			coreRun: 42698245604, coreJob: 129447305943
			, test: "Perl acceptance reconstructs all 18 reports and complete executed probes"
			, failedAssertion:
				"download-pinned-release-asset.sh kotlin-compiler"
			, tests: 635, passed: 478, failed: 1, skipped: 156
			, peakRssBytes: 1898524 * 1024, availableMemoryMiB: 13093
		}
		, rootCause: "The pinned release-asset migration updated the shared Perl callback CI checker's Kotlin expectation without preserving its legacy branch. Immutable 2026-10 acceptance correctly retained the direct kotlin-compiler-2.2.0.zip download, while current CI correctly uses download-pinned-release-asset.sh. The checker incorrectly required the current command for both source epochs."
		, repair: "Select the exact Kotlin asset marker by the existing legacy flag: retain kotlin-compiler-2.2.0.zip for immutable historical workflows and require download-pinned-release-asset.sh kotlin-compiler for current CI. Preserve all execution, evidence, report, support, runtime and package contracts."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, validation: {
			currentContract: {
				tests: 1, passed: 1, failed: 0, durationMs: 400.899587
			}
			, historicalAcceptance: {
				tests: 1, passed: 1, failed: 0
				, durationMs: 96221.874746
			}
			, hostedDiscovery: {
				durationMs: 13130520.129543
				, memoryHealthy: true, oom: false
			}
			, syntax: "passed", eslint: "passed", diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transition, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${historyAdditionRecords.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
