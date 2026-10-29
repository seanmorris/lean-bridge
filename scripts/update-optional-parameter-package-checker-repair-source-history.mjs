#!/usr/bin/env node
/**
 * Record the optional-parameter installed checker repair.
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
	optionalParameterPackageCheckerRepairHistoryAdditions
	, optionalParameterPackageCheckerRepairHistoryPath
	, optionalParameterPackageCheckerRepairImplementation
	, optionalParameterPackageCheckerRepairImplementationPaths
	, optionalParameterPackageCheckerRepairIntegrationPaths
	, optionalParameterPackageCheckerRepairPredecessor
} from "../tests/helpers/optional-parameter-package-checker-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterPackageCheckerRepairHistoryPath), false
	, "Optional package checker repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterPackageCheckerRepairImplementation);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterPackageCheckerRepairPredecessor
	, optionalParameterPackageCheckerRepairImplementation, "--"])
, [...optionalParameterPackageCheckerRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterPackageCheckerRepairPredecessor
	, optionalParameterPackageCheckerRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterPackageCheckerRepairImplementation}:`
		+ optionalParameterPackageCheckerRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterPackageCheckerRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterPackageCheckerRepairHistoryAdditions])
, [...optionalParameterPackageCheckerRepairHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterPackageCheckerRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterPackageCheckerRepairPredecessor
		, optionalParameterPackageCheckerRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-checker-repair-"));
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
	temporaryGit(["read-tree", optionalParameterPackageCheckerRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterPackageCheckerRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterPackageCheckerRepairImplementation]
	, { input: "Authenticate optional package checker repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterPackageCheckerRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterPackageCheckerRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterPackageCheckerRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterPackageCheckerRepairImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterPackageCheckerRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-package-checker-repair-source-v1"
			, predecessorCommit: optionalParameterPackageCheckerRepairPredecessor
			, implementationCommit: optionalParameterPackageCheckerRepairImplementation
			, hostedRun: 40864016726
			, failedJobs: [123414068429, 123414068978, 123414069241]
			, scope: "Make retained Python, Ruby and C++ API checks follow the ordinary arg0 and independently reviewed value0 binders, and share the Kotlin compiler diagnostic contract that accepts both cannot and can not without weakening host-null rejection."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional package checker repair history.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
