#!/usr/bin/env node
/**
 * Record the exact optional-parameter trigger-policy repair.
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
	optionalParameterTriggerPolicyHistoryAdditions
	, optionalParameterTriggerPolicyHistoryPath
	, optionalParameterTriggerPolicyImplementation
	, optionalParameterTriggerPolicyImplementationPaths
	, optionalParameterTriggerPolicyIntegrationPaths
	, optionalParameterTriggerPolicyPredecessor
} from "../tests/helpers/optional-parameter-trigger-policy-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-trigger-policy-source-history.mjs");
assert.equal(existsSync(optionalParameterTriggerPolicyHistoryPath), false
	, `${optionalParameterTriggerPolicyHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterTriggerPolicyImplementation);
assert.equal(git(["rev-parse"
	, `${optionalParameterTriggerPolicyImplementation}^`]).trim()
, optionalParameterTriggerPolicyPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterTriggerPolicyPredecessor
	, optionalParameterTriggerPolicyImplementation, "--"])
, [...optionalParameterTriggerPolicyImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterTriggerPolicyPredecessor
	, optionalParameterTriggerPolicyImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterTriggerPolicyImplementation}:${
		optionalParameterTriggerPolicyHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...optionalParameterTriggerPolicyIntegrationPaths])
, [...optionalParameterTriggerPolicyIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterTriggerPolicyHistoryAdditions])
, [...optionalParameterTriggerPolicyHistoryAdditions].sort());

const policy = await readFile("tests/workflow-trigger-policy.test.mjs", "utf8");
assert.ok(policy.includes(
	'["optional-parameter-complete.yml", ["pull_request", "push"]]'));
assert.ok(policy.includes("approvedAutomaticEvents.size, 12"));
assert.ok(policy.includes("pathScopedAutomaticWorkflows.size, 7"));
const updates = [];
for(const path of optionalParameterTriggerPolicyImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, optionalParameterTriggerPolicyPredecessor
		, optionalParameterTriggerPolicyImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-parameter-trigger-policy-"));
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
	temporaryGit(["read-tree", optionalParameterTriggerPolicyImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterTriggerPolicyIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", optionalParameterTriggerPolicyImplementation
	], { input: "Authenticate optional-parameter trigger policy\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterTriggerPolicyIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterTriggerPolicyImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of optionalParameterTriggerPolicyHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(optionalParameterTriggerPolicyHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "optional-parameter-trigger-policy-source-v1"
		, predecessorCommit: optionalParameterTriggerPolicyPredecessor
		, implementationCommit: optionalParameterTriggerPolicyImplementation
		, supersededRun: 41114133104, detectedBeforeContractShards: true
		, workflow: "optional-parameter-complete.yml"
		, events: ["pull_request", "push"]
		, approvedAutomaticWorkflowCount: 12
		, pathScopedAutomaticWorkflowCount: 7
		, scope: "Classify the complete optional-parameter workflow as the twelfth reviewed automatic workflow and seventh path-scoped workflow. Preserve its explicit narrow path filters, weekly audit, manual audit/producer modes, and the 112-lane bounded recurring sweep. Retain the superseded exact-head Core run that would otherwise reject the unclassified workflow before shard selection."
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transition, `
		+ `${integrationUpdates.length} registrations and one reviewed workflow.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
