#!/usr/bin/env node
/**
 * Record the pinned GitHub release-asset API failover.
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
	assertVo1220ReleaseAssetApiFailover
	, vo1220ReleaseAssetApiFailoverBehavior as behavior
	, vo1220ReleaseAssetApiFailoverHistoryAdditions as historyAdditions
	, vo1220ReleaseAssetApiFailoverHistoryPath as historyPath
	, vo1220ReleaseAssetApiFailoverImplementation as implementation
	, vo1220ReleaseAssetApiFailoverImplementationPaths as implementationPaths
	, vo1220ReleaseAssetApiFailoverIntegrationPaths as integrationPaths
	, vo1220ReleaseAssetApiFailoverPredecessor as predecessor
} from "../tests/helpers/vo1220-release-asset-api-failover-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
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
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220ReleaseAssetApiFailover(sources), { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const inventorySources = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
assert.equal(inventorySources[0], inventorySources[1]);
assert.equal(await readFile(inventoryPath, "utf8"), inventorySources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-release-api-history-"));
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
	], { input: "Authenticate release-asset API failover\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-release-asset-api-failover-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			downstreamRun: 42566901971
			, observedFailedJobs: 10
			, sharedFailure: "HTTP 504 before consumer execution"
			, browserReleaseRoute: "HTTP 504"
			, publicAssetApiRoute: "exact pinned bytes available"
		}
		, rootCause: "The exact-head push preflight reached ten independent Downstream jobs while GitHub's ordinary release browser route and Lean's primary release route returned HTTP 504. Shell, Nix and Docker acquisition failed before product behavior ran, even though GitHub's public immutable release-asset API served the same bytes."
		, repair: "Retain every existing primary URL, digest and compiler identity. On primary transport failure, fetch the exact pinned GitHub asset identity with the octet-stream API contract and apply the existing SHA-256 gate. Give the Nix Lean fetch the same ordered pair of routes and unchanged fixed-output hash."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, currentSourcePins: []
		, inventorySha256: {
			before: sha256(inventorySources[0]), after: sha256(inventorySources[1])
		}
		, validation: {
			focusedContracts: { tests: 3, pass: 3, fail: 0 }
			, completePerformanceContracts: { tests: 11, pass: 11, fail: 0 }
			, documentationContract: { tests: 1, pass: 1, fail: 0 }
			, liveElanApiSha256: "df0b2b3a439961ffcbb3985214365ffe40f49bc871df04dff268c7d8e21ca8b2"
			, currentSourcePinPreflight: { paths: 2661, findings: 0 }
			, shellcheck: "passed with existing dynamic-source informational note"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
