#!/usr/bin/env node
/**
 * Record the optional-parameter PHP binding-identity repair.
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
	optionalParameterPhpBindingIdentityHistoryAdditions
	, optionalParameterPhpBindingIdentityHistoryPath
	, optionalParameterPhpBindingIdentityImplementation
	, optionalParameterPhpBindingIdentityImplementationPaths
	, optionalParameterPhpBindingIdentityIntegrationPaths
	, optionalParameterPhpBindingIdentityPredecessor
} from "../tests/helpers/optional-parameter-php-binding-identity-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterPhpBindingIdentityHistoryPath), false
	, "Optional PHP binding identity history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterPhpBindingIdentityImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterPhpBindingIdentityImplementation}^`]).trim()
, optionalParameterPhpBindingIdentityPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterPhpBindingIdentityPredecessor
	, optionalParameterPhpBindingIdentityImplementation, "--"])
, [...optionalParameterPhpBindingIdentityImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterPhpBindingIdentityPredecessor
	, optionalParameterPhpBindingIdentityImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterPhpBindingIdentityImplementation}:`
		+ optionalParameterPhpBindingIdentityHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterPhpBindingIdentityIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterPhpBindingIdentityHistoryAdditions])
, [...optionalParameterPhpBindingIdentityHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterPhpBindingIdentityImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterPhpBindingIdentityPredecessor
		, optionalParameterPhpBindingIdentityImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-php-binding-"));
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
	temporaryGit(["read-tree", optionalParameterPhpBindingIdentityImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterPhpBindingIdentityIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterPhpBindingIdentityImplementation]
	, { input: "Authenticate optional PHP binding identity repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterPhpBindingIdentityIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterPhpBindingIdentityImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterPhpBindingIdentityHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterPhpBindingIdentityImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterPhpBindingIdentityHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-php-binding-identity-source-v1"
			, predecessorCommit: optionalParameterPhpBindingIdentityPredecessor
			, implementationCommit:
				optionalParameterPhpBindingIdentityImplementation
			, scope: "Preserve the binding identity independently authenticated from the native and PHP-Wasm component records instead of overwriting it with an undefined canonical-build return field."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional PHP binding identity repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
