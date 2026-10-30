#!/usr/bin/env node
/**
 * Record the systems HostNull route-versus-semantic identity repair.
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
	hostNullSystemsSemanticIdentityRepairHistoryAdditions
	, hostNullSystemsSemanticIdentityRepairHistoryPath
	, hostNullSystemsSemanticIdentityRepairImplementation
	, hostNullSystemsSemanticIdentityRepairImplementationPaths
	, hostNullSystemsSemanticIdentityRepairIntegrationPaths
	, hostNullSystemsSemanticIdentityRepairPredecessor
} from "../tests/helpers/host-null-systems-semantic-identity-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-systems-semantic-identity-repair-source-history.mjs");
assert.equal(existsSync(hostNullSystemsSemanticIdentityRepairHistoryPath), false
	, `${hostNullSystemsSemanticIdentityRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullSystemsSemanticIdentityRepairImplementation);
assert.equal(git(["rev-parse", `${hostNullSystemsSemanticIdentityRepairImplementation}^`])
	.trim(), hostNullSystemsSemanticIdentityRepairPredecessor);
assert.deepEqual(
	names(["diff", "--name-only", "--diff-filter=M"
		, hostNullSystemsSemanticIdentityRepairPredecessor
		, hostNullSystemsSemanticIdentityRepairImplementation, "--"])
	, [...hostNullSystemsSemanticIdentityRepairImplementationPaths].sort()
);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullSystemsSemanticIdentityRepairPredecessor
	, hostNullSystemsSemanticIdentityRepairImplementation, "--"]), []);
assert.notEqual(
	spawnSync("git", ["cat-file", "-e"
		, `${hostNullSystemsSemanticIdentityRepairImplementation}`
			+ `:${hostNullSystemsSemanticIdentityRepairHistoryPath}`]
	, { stdio: "ignore" }).status, 0
);
assert.deepEqual(
	names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...hostNullSystemsSemanticIdentityRepairIntegrationPaths])
	, [...hostNullSystemsSemanticIdentityRepairIntegrationPaths].sort()
);
assert.deepEqual(
	names(["ls-files", "--others", "--exclude-standard", "--"
		, ...hostNullSystemsSemanticIdentityRepairHistoryAdditions])
	, [...hostNullSystemsSemanticIdentityRepairHistoryAdditions].sort()
);

const updates = [];
for(const path of hostNullSystemsSemanticIdentityRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, hostNullSystemsSemanticIdentityRepairPredecessor
		, hostNullSystemsSemanticIdentityRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-systems-semantic-identity-repair-"));
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
	temporaryGit(["read-tree", hostNullSystemsSemanticIdentityRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullSystemsSemanticIdentityRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", hostNullSystemsSemanticIdentityRepairImplementation
	], { input: "Authenticate systems HostNull semantic identity repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullSystemsSemanticIdentityRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullSystemsSemanticIdentityRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of hostNullSystemsSemanticIdentityRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(hostNullSystemsSemanticIdentityRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-systems-semantic-identity-repair-source-v1"
		, predecessorCommit: hostNullSystemsSemanticIdentityRepairPredecessor
		, implementationCommit: hostNullSystemsSemanticIdentityRepairImplementation
		, scope: "Repair the exact systems HostNull assertion exposed by complete run 41046161910. Ordinary and reviewed author routes retain distinct complete Binding IR identities while independently derived private ABI projections must share one semantic identity. No runtime behavior, public contract or support claim changes."
		, updates, integrationUpdates, historyAdditions
		, hostedRunId: 41046161910, failedJobId: 124043563884
		, diagnosticArtifactId: 12974567214
		, replayedCells: 40, replayedChecks: 500, replayedExecutions: 16
		, rawRouteIdentities: 2, semanticRouteIdentities: 1
		, supportClaimsChanged: false
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} systems semantic-identity repairs and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
