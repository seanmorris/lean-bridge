#!/usr/bin/env node
/**
 * Record the optional-parameter promotion contract preparation.
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
	optionalParameterPromotionContractHistoryAdditions
	, optionalParameterPromotionContractHistoryPath
	, optionalParameterPromotionContractImplementation
	, optionalParameterPromotionContractImplementationAdditions
	, optionalParameterPromotionContractImplementationPaths
	, optionalParameterPromotionContractIntegrationPaths
	, optionalParameterPromotionContractPredecessor
} from "../tests/helpers/optional-parameter-promotion-contract-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterPromotionContractHistoryPath), false
	, "Optional promotion contract history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterPromotionContractImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterPromotionContractImplementation}^`]).trim()
, optionalParameterPromotionContractPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterPromotionContractPredecessor
	, optionalParameterPromotionContractImplementation, "--"])
, [...optionalParameterPromotionContractImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterPromotionContractPredecessor
	, optionalParameterPromotionContractImplementation, "--"])
, [...optionalParameterPromotionContractImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterPromotionContractImplementation}:`
		+ optionalParameterPromotionContractHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterPromotionContractIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterPromotionContractHistoryAdditions])
, [...optionalParameterPromotionContractHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterPromotionContractImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterPromotionContractPredecessor
		, optionalParameterPromotionContractImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const implementationAdditions = optionalParameterPromotionContractImplementationAdditions
	.map(path => ({
		path
		, sha256: sha256(git(["show"
			, `${optionalParameterPromotionContractImplementation}:${path}`]))
	}));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-promotion-"));
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
	temporaryGit(["read-tree", optionalParameterPromotionContractImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterPromotionContractIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterPromotionContractImplementation]
	, { input: "Authenticate optional parameter promotion contract\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterPromotionContractIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterPromotionContractImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterPromotionContractHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterPromotionContractImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterPromotionContractHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-promotion-contract-source-v1"
			, predecessorCommit: optionalParameterPromotionContractPredecessor
			, implementationCommit:
				optionalParameterPromotionContractImplementation
			, scope: "Define a fail-closed 34-cell optional-parameter promotion that releases only overlapping legacy claims, preserves unrelated delivery shapes, and cannot run without eleven exact artifacts and a complete authenticated reference."
			, updates, implementationAdditions, integrationUpdates
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional promotion contract preparation.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
