#!/usr/bin/env node
/**
 * Record the optional-parameter npm binding-identity repair.
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
	optionalParameterNpmBindingIdentityHistoryAdditions
	, optionalParameterNpmBindingIdentityHistoryPath
	, optionalParameterNpmBindingIdentityImplementation
	, optionalParameterNpmBindingIdentityImplementationPaths
	, optionalParameterNpmBindingIdentityIntegrationPaths
	, optionalParameterNpmBindingIdentityPredecessor
} from "../tests/helpers/optional-parameter-npm-binding-identity-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterNpmBindingIdentityHistoryPath), false
	, "Optional npm binding identity history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterNpmBindingIdentityImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterNpmBindingIdentityImplementation}^`]).trim()
, optionalParameterNpmBindingIdentityPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterNpmBindingIdentityPredecessor
	, optionalParameterNpmBindingIdentityImplementation, "--"])
, [...optionalParameterNpmBindingIdentityImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterNpmBindingIdentityPredecessor
	, optionalParameterNpmBindingIdentityImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterNpmBindingIdentityImplementation}:`
		+ optionalParameterNpmBindingIdentityHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterNpmBindingIdentityIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterNpmBindingIdentityHistoryAdditions])
, [...optionalParameterNpmBindingIdentityHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterNpmBindingIdentityImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterNpmBindingIdentityPredecessor
		, optionalParameterNpmBindingIdentityImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-npm-binding-"));
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
	temporaryGit(["read-tree", optionalParameterNpmBindingIdentityImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterNpmBindingIdentityIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterNpmBindingIdentityImplementation]
	, { input: "Authenticate optional npm binding identity repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterNpmBindingIdentityIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterNpmBindingIdentityImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterNpmBindingIdentityHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterNpmBindingIdentityImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterNpmBindingIdentityHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-npm-binding-identity-source-v1"
			, predecessorCommit: optionalParameterNpmBindingIdentityPredecessor
			, implementationCommit:
				optionalParameterNpmBindingIdentityImplementation
			, scope: "Preserve the optional npm bundle's authenticated Binding IR identity in retained evidence, require the package receipt to agree with it, and prevent an undefined canonical-build return field from erasing the digest."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional npm binding identity repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
