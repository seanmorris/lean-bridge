#!/usr/bin/env node
/**
 * Record the final focused HostNull managed and systems gate repair.
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
	hostNullFinalGateRepairHistoryAdditions
	, hostNullFinalGateRepairHistoryPath
	, hostNullFinalGateRepairImplementation
	, hostNullFinalGateRepairImplementationPaths
	, hostNullFinalGateRepairIntegrationPaths
	, hostNullFinalGateRepairPredecessor
} from "../tests/helpers/host-null-final-gate-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-final-gate-repair-source-history.mjs");
assert.equal(existsSync(hostNullFinalGateRepairHistoryPath), false
	, `${hostNullFinalGateRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullFinalGateRepairImplementation);
assert.equal(git(["rev-parse", `${hostNullFinalGateRepairImplementation}^`])
	.trim(), hostNullFinalGateRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullFinalGateRepairPredecessor
	, hostNullFinalGateRepairImplementation, "--"])
, [...hostNullFinalGateRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullFinalGateRepairPredecessor
	, hostNullFinalGateRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullFinalGateRepairImplementation}`
		+ `:${hostNullFinalGateRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...hostNullFinalGateRepairIntegrationPaths])
, [...hostNullFinalGateRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullFinalGateRepairHistoryAdditions])
, [...hostNullFinalGateRepairHistoryAdditions].sort());

const updates = [];
for(const path of hostNullFinalGateRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, hostNullFinalGateRepairPredecessor
		, hostNullFinalGateRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-final-gate-repair-"));
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
	temporaryGit(["read-tree", hostNullFinalGateRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullFinalGateRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", hostNullFinalGateRepairImplementation
	], { input: "Authenticate final HostNull gate repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullFinalGateRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullFinalGateRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of hostNullFinalGateRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(hostNullFinalGateRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-final-gate-repair-source-v1"
		, predecessorCommit: hostNullFinalGateRepairPredecessor
		, implementationCommit: hostNullFinalGateRepairImplementation
		, scope: "Repair the exact final-gate defects exposed by complete HostNull run 41040646713 after all affected runtime executions completed. The managed checker now consumes the canonical profile-to-fixture map used by its producer, and the systems installer verifies the generated WIT alias graph that preserves HostNull (Option T) and Option (HostNull T). No generator behavior, public contract or support claim changes."
		, updates, integrationUpdates, historyAdditions
		, hostedRunId: 41040646713
		, failedJobIds: [124021991307, 124021991314, 124021991342
			, 124028369157]
		, diagnosticArtifactIds: [12971188224, 12972145611, 12972235145]
		, replayedManagedChecks: 132
		, supportClaimsChanged: false
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} final gate repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
