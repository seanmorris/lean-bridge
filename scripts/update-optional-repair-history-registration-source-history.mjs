#!/usr/bin/env node
/**
 * Record extraction of current optional-repair history from partition 11.
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
	optionalRepairHistoryRegistrationHistoryAdditions
	, optionalRepairHistoryRegistrationHistoryPath
	, optionalRepairHistoryRegistrationImplementation
	, optionalRepairHistoryRegistrationImplementationPaths
	, optionalRepairHistoryRegistrationIntegrationPaths
	, optionalRepairHistoryRegistrationPredecessor
} from "../tests/helpers/optional-repair-history-registration-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalRepairHistoryRegistrationHistoryPath), false
	, "Optional repair registration history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalRepairHistoryRegistrationImplementation);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalRepairHistoryRegistrationPredecessor
	, optionalRepairHistoryRegistrationImplementation, "--"])
, [...optionalRepairHistoryRegistrationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalRepairHistoryRegistrationPredecessor
	, optionalRepairHistoryRegistrationImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalRepairHistoryRegistrationImplementation}:`
		+ optionalRepairHistoryRegistrationHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalRepairHistoryRegistrationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalRepairHistoryRegistrationHistoryAdditions])
, [...optionalRepairHistoryRegistrationHistoryAdditions].sort());

const updates = [];
for(const path of optionalRepairHistoryRegistrationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalRepairHistoryRegistrationPredecessor
		, optionalRepairHistoryRegistrationImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-history-register-"));
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
	temporaryGit(["read-tree", optionalRepairHistoryRegistrationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalRepairHistoryRegistrationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalRepairHistoryRegistrationImplementation]
	, { input: "Authenticate optional repair history registration\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalRepairHistoryRegistrationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalRepairHistoryRegistrationImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalRepairHistoryRegistrationHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalRepairHistoryRegistrationImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalRepairHistoryRegistrationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-repair-history-registration-source-v1"
			, predecessorCommit: optionalRepairHistoryRegistrationPredecessor
			, implementationCommit: optionalRepairHistoryRegistrationImplementation
			, scope: "Keep the focused-producer, WIT-identity and package-checker history suites registered through the existing optional installed-contract test while restoring partition 11 to its exact pre-optimization bytes. This prevents current repairs from invalidating older partition milestones without dropping any test."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional repair history registration.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
