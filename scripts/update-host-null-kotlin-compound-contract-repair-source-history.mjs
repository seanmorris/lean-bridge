#!/usr/bin/env node
/**
 * Record the Kotlin compound contract repair for explicit HostNull values.
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
	hostNullKotlinCompoundContractRepairHistoryAdditions
	, hostNullKotlinCompoundContractRepairHistoryPath
	, hostNullKotlinCompoundContractRepairImplementation
	, hostNullKotlinCompoundContractRepairImplementationPaths
	, hostNullKotlinCompoundContractRepairIntegrationPaths
	, hostNullKotlinCompoundContractRepairPredecessor
} from "../tests/helpers/host-null-kotlin-compound-contract-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-kotlin-compound-contract-repair-source-history.mjs");
assert.equal(existsSync(hostNullKotlinCompoundContractRepairHistoryPath), false
	, `${hostNullKotlinCompoundContractRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullKotlinCompoundContractRepairImplementation);
assert.equal(git(["rev-parse"
	, `${hostNullKotlinCompoundContractRepairImplementation}^`]).trim()
, hostNullKotlinCompoundContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullKotlinCompoundContractRepairPredecessor
	, hostNullKotlinCompoundContractRepairImplementation, "--"])
, [...hostNullKotlinCompoundContractRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullKotlinCompoundContractRepairPredecessor
	, hostNullKotlinCompoundContractRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullKotlinCompoundContractRepairImplementation}`
		+ `:${hostNullKotlinCompoundContractRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...hostNullKotlinCompoundContractRepairIntegrationPaths])
, [...hostNullKotlinCompoundContractRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullKotlinCompoundContractRepairHistoryAdditions])
, [...hostNullKotlinCompoundContractRepairHistoryAdditions].sort());

const updates = [];
for(const path of hostNullKotlinCompoundContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, hostNullKotlinCompoundContractRepairPredecessor
		, hostNullKotlinCompoundContractRepairImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }
	));

const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-kotlin-contract-repair-"));
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
	temporaryGit(["read-tree", hostNullKotlinCompoundContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullKotlinCompoundContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, hostNullKotlinCompoundContractRepairImplementation
	], { input: "Authenticate Kotlin HostNull contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullKotlinCompoundContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullKotlinCompoundContractRepairImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of hostNullKotlinCompoundContractRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(hostNullKotlinCompoundContractRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "host-null-kotlin-compound-contract-repair-source-v1"
			, predecessorCommit: hostNullKotlinCompoundContractRepairPredecessor
			, implementationCommit:
				hostNullKotlinCompoundContractRepairImplementation
			, scope: "Align the full Kotlin compound contract with the established explicit HostNull semantics: Option, Result and Pair generic parameters remain nullable so nested HostNull values preserve None, Some(null) and Some(value). Reject stale non-null generic bounds and requireNonNull without rejecting legitimate nullable kotlin.Any? equality and hashing internals. No support claim or generator semantics change."
			, updates, integrationUpdates, historyAdditions
			, semanticImplementationCommit:
				"bbcf283d4ad2fde8b03fd110242326a8510570e8"
			, hostedProducerRunId: 41040646713
			, supportClaimsChanged: false
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} contract repair and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
