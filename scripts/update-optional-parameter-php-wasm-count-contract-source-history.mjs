#!/usr/bin/env node
/**
 * Record the optional-parameter PHP-Wasm count-contract repair.
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
	optionalParameterPhpWasmCountContractHistoryAdditions
	, optionalParameterPhpWasmCountContractHistoryPath
	, optionalParameterPhpWasmCountContractImplementation
	, optionalParameterPhpWasmCountContractImplementationPaths
	, optionalParameterPhpWasmCountContractIntegrationPaths
	, optionalParameterPhpWasmCountContractPredecessor
} from "../tests/helpers/optional-parameter-php-wasm-count-contract-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterPhpWasmCountContractHistoryPath), false
	, "Optional PHP-Wasm count contract history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterPhpWasmCountContractImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterPhpWasmCountContractImplementation}^`]).trim()
, optionalParameterPhpWasmCountContractPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterPhpWasmCountContractPredecessor
	, optionalParameterPhpWasmCountContractImplementation, "--"])
, [...optionalParameterPhpWasmCountContractImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterPhpWasmCountContractPredecessor
	, optionalParameterPhpWasmCountContractImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterPhpWasmCountContractImplementation}:`
		+ optionalParameterPhpWasmCountContractHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterPhpWasmCountContractIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterPhpWasmCountContractHistoryAdditions])
, [...optionalParameterPhpWasmCountContractHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterPhpWasmCountContractImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterPhpWasmCountContractPredecessor
		, optionalParameterPhpWasmCountContractImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-php-count-"));
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
	temporaryGit(["read-tree", optionalParameterPhpWasmCountContractImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterPhpWasmCountContractIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterPhpWasmCountContractImplementation]
	, { input: "Authenticate optional PHP-Wasm count contract repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterPhpWasmCountContractIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterPhpWasmCountContractImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterPhpWasmCountContractHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterPhpWasmCountContractImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterPhpWasmCountContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-php-wasm-count-contract-source-v1"
			, predecessorCommit: optionalParameterPhpWasmCountContractPredecessor
			, implementationCommit:
				optionalParameterPhpWasmCountContractImplementation
			, scope: "Permit an explicit exact check count for small PHP-Wasm fixtures while preserving the existing thousand-check minimum for every fixture that does not opt into an exact count."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional PHP-Wasm count contract repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
