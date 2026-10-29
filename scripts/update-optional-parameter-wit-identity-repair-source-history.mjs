#!/usr/bin/env node
/**
 * Record the optional-parameter WIT package-identity repair.
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
	optionalParameterWitIdentityRepairHistoryAdditions
	, optionalParameterWitIdentityRepairHistoryPath
	, optionalParameterWitIdentityRepairImplementation
	, optionalParameterWitIdentityRepairImplementationPaths
	, optionalParameterWitIdentityRepairIntegrationPaths
	, optionalParameterWitIdentityRepairPredecessor
} from "../tests/helpers/optional-parameter-wit-identity-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterWitIdentityRepairHistoryPath), false
	, "Optional WIT identity repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterWitIdentityRepairImplementation);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterWitIdentityRepairPredecessor
	, optionalParameterWitIdentityRepairImplementation, "--"])
, [...optionalParameterWitIdentityRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterWitIdentityRepairPredecessor
	, optionalParameterWitIdentityRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterWitIdentityRepairImplementation}:`
		+ optionalParameterWitIdentityRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterWitIdentityRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterWitIdentityRepairHistoryAdditions])
, [...optionalParameterWitIdentityRepairHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterWitIdentityRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterWitIdentityRepairPredecessor
		, optionalParameterWitIdentityRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-optional-wit-identity-"));
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
	temporaryGit(["read-tree", optionalParameterWitIdentityRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterWitIdentityRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterWitIdentityRepairImplementation]
	, { input: "Authenticate optional WIT package identity\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterWitIdentityRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterWitIdentityRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterWitIdentityRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterWitIdentityRepairImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterWitIdentityRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-wit-identity-repair-source-v1"
			, predecessorCommit: optionalParameterWitIdentityRepairPredecessor
			, implementationCommit: optionalParameterWitIdentityRepairImplementation
			, hostedRun: 40864016726
			, failedJob: 123414069215
			, scope: "Read retained WIT evidence from the authenticated published package identity while preserving the distinct Lean module prefix used by generated Wasmtime headers. The package remains closed against its archive receipt and relocation is still exercised before evidence retention."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional WIT identity repair history.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
