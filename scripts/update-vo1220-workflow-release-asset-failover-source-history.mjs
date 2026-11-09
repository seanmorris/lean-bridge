#!/usr/bin/env node
/**
 * Record the complete checksummed workflow release-asset failover.
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
	assertVo1220WorkflowReleaseAssetFailover
	, vo1220WorkflowReleaseAssetFailoverBehavior as behavior
	, vo1220WorkflowReleaseAssetFailoverChangedPaths as changedPaths
	, vo1220WorkflowReleaseAssetFailoverHistoryAdditions as historyAdditions
	, vo1220WorkflowReleaseAssetFailoverHistoryPath as historyPath
	, vo1220WorkflowReleaseAssetFailoverImplementation as implementation
	, vo1220WorkflowReleaseAssetFailoverImplementationAddedPaths as implementationAddedPaths
	, vo1220WorkflowReleaseAssetFailoverImplementationPaths as implementationPaths
	, vo1220WorkflowReleaseAssetFailoverIntegrationPaths as integrationPaths
	, vo1220WorkflowReleaseAssetFailoverPredecessor as predecessor
} from "../tests/helpers/vo1220-workflow-release-asset-failover-source-history.mjs";

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
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...changedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), [...implementationAddedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=DRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220WorkflowReleaseAssetFailover(sources)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const inventorySources = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
assert.equal(inventorySources[0], inventorySources[1]);
assert.equal(await readFile(inventoryPath, "utf8"), inventorySources[1]);

const updates = [];
for(const path of changedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const implementationAdditions = implementationAddedPaths.map(path => {
	assert.equal(git(["ls-tree", "--name-only", predecessor, "--", path])
		.trim(), "", path);
	return { path, sha256: sha256(blob(implementation, path)) };
});

const directory = await mkdtemp(join(tmpdir(), "lean-workflow-release-history-"));
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
	], { input: "Authenticate complete workflow release-asset failover\n" })
		.trim();
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
		, milestone: "vo1220-workflow-release-asset-failover-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			downstreamRun: 42566901971
			, observedFailedJobsAtAudit: 13
			, directReleaseAssetClasses: ["kotlin-compiler", "wasmtime-c-api"]
			, uncoveredWorkflowCallSites: 35
			, sharedFailure: "HTTP 504 before consumer execution"
		}
		, rootCause: "The first failover covered shared bootstrap and Nix Lean acquisition, but the complete workflow inventory found 35 direct browser-release downloads for two additional checksummed assets. Those jobs could still fail before product execution when GitHub's browser route returned HTTP 504."
		, repair: "Route all 17 Kotlin and 18 Wasmtime workflow acquisitions through one fail-closed helper. Retain each browser URL, immutable public asset API identity and SHA-256 digest; accept bytes only after the digest gate and publish the destination atomically."
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
			focusedWorkflowContracts: { tests: 8, pass: 8, fail: 0 }
			, completePerformanceContracts: { tests: 12, pass: 12, fail: 0 }
			, liveWasmtimeApiSha256: "2097a47351918a446b26c7e65f487278f63bc947591b71897db547cd90c05082"
			, liveWasmtimeApiBytes: 13113104
			, workflowBrowserReleaseUrls: 0
			, shellcheck: "passed"
			, eslint: "passed"
			, typecheck: "passed"
			, workflowYamlParse: "passed"
		}
		, implementationAdditions, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${implementationAdditions.length} implementation additions and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
