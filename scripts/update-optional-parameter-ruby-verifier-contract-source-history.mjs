#!/usr/bin/env node
/**
 * Record the optional-parameter Ruby verifier contract repair.
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
	optionalParameterRubyVerifierContractHistoryAdditions
	, optionalParameterRubyVerifierContractHistoryPath
	, optionalParameterRubyVerifierContractImplementation
	, optionalParameterRubyVerifierContractImplementationPaths
	, optionalParameterRubyVerifierContractIntegrationPaths
	, optionalParameterRubyVerifierContractPredecessor
} from "../tests/helpers/optional-parameter-ruby-verifier-contract-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterRubyVerifierContractHistoryPath), false
	, "Optional Ruby verifier contract history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterRubyVerifierContractImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterRubyVerifierContractImplementation}^`]).trim()
, optionalParameterRubyVerifierContractPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterRubyVerifierContractPredecessor
	, optionalParameterRubyVerifierContractImplementation, "--"])
, [...optionalParameterRubyVerifierContractImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterRubyVerifierContractPredecessor
	, optionalParameterRubyVerifierContractImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterRubyVerifierContractImplementation}:`
		+ optionalParameterRubyVerifierContractHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterRubyVerifierContractIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterRubyVerifierContractHistoryAdditions])
, [...optionalParameterRubyVerifierContractHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterRubyVerifierContractImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterRubyVerifierContractPredecessor
		, optionalParameterRubyVerifierContractImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-ruby-verifier-"));
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
	temporaryGit(["read-tree", optionalParameterRubyVerifierContractImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterRubyVerifierContractIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterRubyVerifierContractImplementation]
	, { input: "Authenticate optional Ruby verifier contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterRubyVerifierContractIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterRubyVerifierContractImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterRubyVerifierContractHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterRubyVerifierContractImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterRubyVerifierContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-ruby-verifier-contract-source-v1"
			, predecessorCommit: optionalParameterRubyVerifierContractPredecessor
			, implementationCommit:
				optionalParameterRubyVerifierContractImplementation
			, scope: "Make retained Ruby package verification match the generated positional arg0 API for both authoring routes while keeping route validation fail closed."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional Ruby verifier contract repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
