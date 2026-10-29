#!/usr/bin/env node
/**
 * Record the historical self-authentication repair.
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
	historicalSelfAuthenticationRepairHistoryAdditions
	, historicalSelfAuthenticationRepairHistoryPath
	, historicalSelfAuthenticationRepairImplementation
	, historicalSelfAuthenticationRepairImplementationPaths
	, historicalSelfAuthenticationRepairIntegrationPaths
	, historicalSelfAuthenticationRepairPredecessor
} from "../tests/helpers/historical-self-authentication-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historicalSelfAuthenticationRepairHistoryPath), false
	, "Historical self-authentication repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, historicalSelfAuthenticationRepairImplementation);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, historicalSelfAuthenticationRepairPredecessor
	, historicalSelfAuthenticationRepairImplementation, "--"])
, [...historicalSelfAuthenticationRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, historicalSelfAuthenticationRepairPredecessor
	, historicalSelfAuthenticationRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${historicalSelfAuthenticationRepairImplementation}:`
		+ historicalSelfAuthenticationRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...historicalSelfAuthenticationRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historicalSelfAuthenticationRepairHistoryAdditions])
, [...historicalSelfAuthenticationRepairHistoryAdditions].sort());

const updates = [];
for(const path of historicalSelfAuthenticationRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, historicalSelfAuthenticationRepairPredecessor
		, historicalSelfAuthenticationRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-self-auth-repair-"));
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
		"git", arguments_, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options });
	temporaryGit(["read-tree", historicalSelfAuthenticationRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...historicalSelfAuthenticationRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, historicalSelfAuthenticationRepairImplementation]
	, { input: "Authenticate historical self-authentication repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of historicalSelfAuthenticationRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, historicalSelfAuthenticationRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of historicalSelfAuthenticationRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, historicalSelfAuthenticationRepairImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(historicalSelfAuthenticationRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "historical-self-authentication-repair-source-v1"
			, predecessorCommit: historicalSelfAuthenticationRepairPredecessor
			, implementationCommit:
				historicalSelfAuthenticationRepairImplementation
			, scope: "Authenticate recorded history controls and additions from their exact retained milestone bytes rather than from subsequently edited live test files."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded historical self-authentication repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
