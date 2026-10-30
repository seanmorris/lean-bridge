#!/usr/bin/env node
/**
 * Record the focused HostNull managed and systems producer repair.
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
import {
	gitSourceHistoryTransition
} from "../tests/helpers/source-history-stream.mjs";
import {
	hostNullManagedSystemsRepairHistoryAdditions
	, hostNullManagedSystemsRepairHistoryPath
	, hostNullManagedSystemsRepairImplementation
	, hostNullManagedSystemsRepairImplementationPaths
	, hostNullManagedSystemsRepairIntegrationPaths
	, hostNullManagedSystemsRepairPredecessor
} from "../tests/helpers/host-null-managed-systems-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-managed-systems-repair-source-history.mjs");
assert.equal(existsSync(hostNullManagedSystemsRepairHistoryPath), false
	, `${hostNullManagedSystemsRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullManagedSystemsRepairImplementation);
assert.equal(git(["rev-parse"
	, `${hostNullManagedSystemsRepairImplementation}^`]).trim()
, hostNullManagedSystemsRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullManagedSystemsRepairPredecessor
	, hostNullManagedSystemsRepairImplementation, "--"])
, [...hostNullManagedSystemsRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullManagedSystemsRepairPredecessor
	, hostNullManagedSystemsRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullManagedSystemsRepairImplementation}`
		+ `:${hostNullManagedSystemsRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...hostNullManagedSystemsRepairIntegrationPaths])
, [...hostNullManagedSystemsRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullManagedSystemsRepairHistoryAdditions])
, [...hostNullManagedSystemsRepairHistoryAdditions].sort());

const updates = [];
for(const path of hostNullManagedSystemsRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, hostNullManagedSystemsRepairPredecessor
		, hostNullManagedSystemsRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-managed-systems-repair-"));
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
			encoding: "utf8", maxBuffer: 64 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", hostNullManagedSystemsRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullManagedSystemsRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", hostNullManagedSystemsRepairImplementation
	], { input: "Authenticate focused HostNull producer repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullManagedSystemsRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullManagedSystemsRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of hostNullManagedSystemsRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(hostNullManagedSystemsRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-managed-systems-repair-source-v1"
		, predecessorCommit: hostNullManagedSystemsRepairPredecessor
		, implementationCommit: hostNullManagedSystemsRepairImplementation
		, scope: "Repair three exact HostNull failures from run 41034251688: select the committed managed consumer fixtures by filename, retain JetBrains annotations on the closed Java compiler classpath, and leave systems output creation to the acceptance test. Preserve all HostNull semantics, profile cells, package routes, artifact gates and fail-closed receipt reconciliation."
		, updates, integrationUpdates, historyAdditions
		, hostedRunId: 41034251688
		, failedJobIds: [124003451593, 124003451626, 124003451779]
		, supportClaimsChanged: false
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} producer repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
