#!/usr/bin/env node
/**
 * Record the optional-parameter route acceptance repair.
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
	optionalParameterRouteAcceptanceRepairHistoryAdditions
	, optionalParameterRouteAcceptanceRepairHistoryPath
	, optionalParameterRouteAcceptanceRepairImplementation
	, optionalParameterRouteAcceptanceRepairImplementationPaths
	, optionalParameterRouteAcceptanceRepairIntegrationPaths
	, optionalParameterRouteAcceptanceRepairPredecessor
} from "../tests/helpers/optional-parameter-route-acceptance-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(optionalParameterRouteAcceptanceRepairHistoryPath), false
	, "Optional route acceptance repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterRouteAcceptanceRepairImplementation);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterRouteAcceptanceRepairPredecessor
	, optionalParameterRouteAcceptanceRepairImplementation, "--"])
, [...optionalParameterRouteAcceptanceRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterRouteAcceptanceRepairPredecessor
	, optionalParameterRouteAcceptanceRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterRouteAcceptanceRepairImplementation}:`
		+ optionalParameterRouteAcceptanceRepairHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterRouteAcceptanceRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterRouteAcceptanceRepairHistoryAdditions])
, [...optionalParameterRouteAcceptanceRepairHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterRouteAcceptanceRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterRouteAcceptanceRepairPredecessor
		, optionalParameterRouteAcceptanceRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));
const directory = await mkdtemp(join(tmpdir(), "lean-optional-route-acceptance-"));
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
	temporaryGit(["read-tree", optionalParameterRouteAcceptanceRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterRouteAcceptanceRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(["commit-tree", tree, "-p"
		, optionalParameterRouteAcceptanceRepairImplementation]
	, { input: "Authenticate optional route acceptance repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterRouteAcceptanceRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterRouteAcceptanceRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of optionalParameterRouteAcceptanceRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterRouteAcceptanceRepairImplementation, "--", path])
			.trim(), "");
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterRouteAcceptanceRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-route-acceptance-repair-source-v1"
			, predecessorCommit: optionalParameterRouteAcceptanceRepairPredecessor
			, implementationCommit:
				optionalParameterRouteAcceptanceRepairImplementation
			, scope: "Use the compiler-authenticated ordinary or reviewed binder in npm and PHP acceptance, distinguish native PHP integers from PHP-Wasm BigInteger values, and validate each generated PHP surface against its exact runtime profile."
			, updates, integrationUpdates, implementationAdditions: []
			, historyAdditions, currentSourcePaths: [], refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write("Recorded optional route acceptance repair.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
