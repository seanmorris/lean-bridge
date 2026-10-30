#!/usr/bin/env node
/**
 * Record the optional pin-test milestone repair.
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
	optionalParameterPinTestMilestoneHistoryAdditions
	, optionalParameterPinTestMilestoneHistoryPath
	, optionalParameterPinTestMilestoneImplementation
	, optionalParameterPinTestMilestoneImplementationPaths
	, optionalParameterPinTestMilestoneIntegrationPaths
	, optionalParameterPinTestMilestonePredecessor
} from "../tests/helpers/optional-parameter-pin-test-milestone-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-pin-test-milestone-source-history.mjs");
assert.equal(existsSync(optionalParameterPinTestMilestoneHistoryPath), false
	, `${optionalParameterPinTestMilestoneHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterPinTestMilestoneImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterPinTestMilestoneImplementation}^`]).trim()
, optionalParameterPinTestMilestonePredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterPinTestMilestonePredecessor
	, optionalParameterPinTestMilestoneImplementation, "--"])
, [...optionalParameterPinTestMilestoneImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterPinTestMilestonePredecessor
	, optionalParameterPinTestMilestoneImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterPinTestMilestoneImplementation}`
		+ `:${optionalParameterPinTestMilestoneHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterPinTestMilestoneIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterPinTestMilestoneHistoryAdditions])
, [...optionalParameterPinTestMilestoneHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterPinTestMilestoneImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterPinTestMilestonePredecessor
		, optionalParameterPinTestMilestoneImplementation
		, { maximumEditBytes: 8 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-pin-test-milestone-"));
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
	temporaryGit(["read-tree", optionalParameterPinTestMilestoneImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterPinTestMilestoneIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, optionalParameterPinTestMilestoneImplementation
	], { input: "Authenticate optional pin-test milestone repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterPinTestMilestoneIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterPinTestMilestoneImplementation
			, integrationCommit, { maximumEditBytes: 16 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterPinTestMilestoneHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(optionalParameterPinTestMilestoneHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-pin-test-milestone-source-v1"
			, predecessorCommit: optionalParameterPinTestMilestonePredecessor
			, implementationCommit: optionalParameterPinTestMilestoneImplementation
			, scope: "Bind the optional promotion-reader pin assertion to the immutable repair milestone so later type-surface promotions remain valid."
			, updates, integrationUpdates, historyAdditions
			, observedTest: "tests/checked-javascript-partition-11.test.mjs"
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} optional pin-test repair and `
		+ `${integrationUpdates.length} registrations.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
