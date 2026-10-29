#!/usr/bin/env node
/**
 * Record the optional-parameter WIT report contract repair.
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
	optionalParameterWitReportContractHistoryAdditions
	, optionalParameterWitReportContractHistoryPath
	, optionalParameterWitReportContractImplementation
	, optionalParameterWitReportContractImplementationPaths
	, optionalParameterWitReportContractIntegrationPaths
	, optionalParameterWitReportContractPredecessor
} from "../tests/helpers/optional-parameter-wit-report-contract-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterWitReportContractHistoryPath), false
	, "Optional WIT report contract history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterWitReportContractImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterWitReportContractImplementation}^`]).trim()
, optionalParameterWitReportContractPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterWitReportContractPredecessor
	, optionalParameterWitReportContractImplementation, "--"])
, [...optionalParameterWitReportContractImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterWitReportContractPredecessor
	, optionalParameterWitReportContractImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterWitReportContractImplementation}:`
		+ optionalParameterWitReportContractHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterWitReportContractIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterWitReportContractHistoryAdditions])
, [...optionalParameterWitReportContractHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterWitReportContractImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterWitReportContractPredecessor
		, optionalParameterWitReportContractImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-wit-report-"));
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
	temporaryGit(["read-tree", optionalParameterWitReportContractImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterWitReportContractIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterWitReportContractImplementation]
	, { input: "Authenticate optional WIT report contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterWitReportContractIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterWitReportContractImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterWitReportContractHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterWitReportContractImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterWitReportContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-wit-report-contract-source-v1"
			, predecessorCommit: optionalParameterWitReportContractPredecessor
			, implementationCommit:
				optionalParameterWitReportContractImplementation
			, scope: "Make retained WIT report verification reuse the shared ordinary/reviewed binder contract instead of a private reviewed-only value0 pattern, and forbid reintroduction of that duplicate."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional WIT report contract repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
