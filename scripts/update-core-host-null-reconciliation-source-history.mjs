#!/usr/bin/env node
/**
 * Record the final HostNull/Core reconciliation exposed by full contract shards.
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
	coreHostNullReconciliationHistoryAdditions
	, coreHostNullReconciliationHistoryPath
	, coreHostNullReconciliationImplementation
	, coreHostNullReconciliationImplementationPaths
	, coreHostNullReconciliationIntegrationPaths
	, coreHostNullReconciliationPinnedPaths
	, coreHostNullReconciliationPredecessor
	, coreHostNullReconciliationRefreshedPins
} from "../tests/helpers/core-host-null-reconciliation-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-host-null-reconciliation-source-history.mjs");
assert.equal(existsSync(coreHostNullReconciliationHistoryPath), false
	, `${coreHostNullReconciliationHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreHostNullReconciliationImplementation);
assert.equal(git(["rev-parse", `${coreHostNullReconciliationImplementation}^`])
	.trim(), coreHostNullReconciliationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreHostNullReconciliationPredecessor
	, coreHostNullReconciliationImplementation, "--"])
, [...coreHostNullReconciliationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreHostNullReconciliationPredecessor
	, coreHostNullReconciliationImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${coreHostNullReconciliationImplementation}:${
		coreHostNullReconciliationHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreHostNullReconciliationIntegrationPaths])
, [...coreHostNullReconciliationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreHostNullReconciliationHistoryAdditions])
, [...coreHostNullReconciliationHistoryAdditions].sort());

const updates = [];
for(const path of coreHostNullReconciliationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreHostNullReconciliationPredecessor
		, coreHostNullReconciliationImplementation
		, { maximumEditBytes: 256 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-host-null-reconciliation-"));
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
	temporaryGit(["read-tree", coreHostNullReconciliationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreHostNullReconciliationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreHostNullReconciliationImplementation
	], { input: "Authenticate final HostNull/Core reconciliation\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreHostNullReconciliationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreHostNullReconciliationImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreHostNullReconciliationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreHostNullReconciliationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-host-null-reconciliation-source-v1"
		, predecessorCommit: coreHostNullReconciliationPredecessor
		, implementationCommit: coreHostNullReconciliationImplementation
		, failedRun: 41085548611
		, affectedJobs: [
			124185638900, 124185638929, 124185639012
			, 124185639127, 124185639197
		]
		, scope: "Reconcile the final HostNull/Core full-shard failures without rewriting immutable evidence: preserve staged HostNull history, exact producer code generation, current managed gates, workflow mutation coverage and historical type-surface classification. Refresh only live source citations and register the complete repair as one reversible transition."
		, updates, integrationUpdates, historyAdditions
		, refreshedPins: coreHostNullReconciliationRefreshedPins
		, pinnedPaths: coreHostNullReconciliationPinnedPaths
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and `
		+ `${coreHostNullReconciliationRefreshedPins} live pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
