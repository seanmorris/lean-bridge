#!/usr/bin/env node
/**
 * Record the exact final Core test-registration repair.
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
	coreFinalTestRegistrationHistoryAdditions
	, coreFinalTestRegistrationHistoryPath
	, coreFinalTestRegistrationImplementation
	, coreFinalTestRegistrationImplementationPaths
	, coreFinalTestRegistrationIntegrationPaths
	, coreFinalTestRegistrationPins
	, coreFinalTestRegistrationPredecessor
	, coreFinalTestRegistrationTests
} from "../tests/helpers/core-final-test-registration-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-final-test-registration-source-history.mjs");
assert.equal(existsSync(coreFinalTestRegistrationHistoryPath), false
	, `${coreFinalTestRegistrationHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreFinalTestRegistrationImplementation);
assert.equal(git(["rev-parse", `${coreFinalTestRegistrationImplementation}^`])
	.trim(), coreFinalTestRegistrationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreFinalTestRegistrationPredecessor
	, coreFinalTestRegistrationImplementation, "--"])
, [...coreFinalTestRegistrationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreFinalTestRegistrationPredecessor
	, coreFinalTestRegistrationImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${coreFinalTestRegistrationImplementation}:${
		coreFinalTestRegistrationHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreFinalTestRegistrationIntegrationPaths])
, [...coreFinalTestRegistrationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreFinalTestRegistrationHistoryAdditions])
, [...coreFinalTestRegistrationHistoryAdditions].sort());

const inventoryPath = coreFinalTestRegistrationImplementationPaths[0];
const before = git(["show"
	, `${coreFinalTestRegistrationPredecessor}:${inventoryPath}`]);
const after = git(["show"
	, `${coreFinalTestRegistrationImplementation}:${inventoryPath}`]);
let restored = after;
for(const pin of coreFinalTestRegistrationPins)
{
	restored = restored.replaceAll(pin.current, pin.previous);
	assert.equal(after.split(pin.current).length - 1, pin.count);
	assert.equal(after.includes(pin.previous), false);
	assert.equal(sha256(await readFile(pin.path)), pin.current);
}
assert.equal(restored, before);
const beforeDocument = JSON.parse(before), afterDocument = JSON.parse(after);
assert.deepEqual(afterDocument.profiles, beforeDocument.profiles);
assert.deepEqual(afterDocument.observations, beforeDocument.observations);
const profile = await readFile("src/adoption/test-profiles.mjs", "utf8");
const profileTest = await readFile("tests/test-profiles.test.mjs", "utf8");
for(const name of coreFinalTestRegistrationTests)
{
	assert.ok(profile.includes(`"${name}"`), name);
	assert.ok(profileTest.includes(`"${name}"`), name);
}

const updates = [];
for(const path of coreFinalTestRegistrationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreFinalTestRegistrationPredecessor
		, coreFinalTestRegistrationImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-final-test-registration-"));
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
			encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree", coreFinalTestRegistrationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreFinalTestRegistrationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreFinalTestRegistrationImplementation
	], { input: "Authenticate final Core test registration\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreFinalTestRegistrationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreFinalTestRegistrationImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreFinalTestRegistrationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreFinalTestRegistrationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-final-test-registration-source-v1"
		, predecessorCommit: coreFinalTestRegistrationPredecessor
		, implementationCommit: coreFinalTestRegistrationImplementation
		, failedRun: 41079000565
		, failedJobs: [124159992526, 124159992687]
		, failedTest: "tests/dependent-signature-complete-hosted-evidence.test.mjs"
		, registeredTests: coreFinalTestRegistrationTests
		, refreshedPins: coreFinalTestRegistrationPins
		, contractFiles: 1093
		, contractSha256: "b3918c6797e8d3ae7e0c33022eb22f041a4cdfc94393833764c3c72888c97f7f"
		, scope: "Register exactly nine final acceptance tests in the closed Core contract profile after two shards independently exposed the same pre-partition refusal. Assert their exact Core classification, refresh only 102 live inventory citations, preserve all profiles and observations, and retain the cancelled exact-head run plus reversible implementation and integration transitions."
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 9 Core tests.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
