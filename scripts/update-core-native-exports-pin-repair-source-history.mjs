#!/usr/bin/env node
/**
 * Record the exact NativeExports live-pin repair exposed by final Core.
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
	coreNativeExportsPinRepairCurrentDigest
	, coreNativeExportsPinRepairHistoryAdditions
	, coreNativeExportsPinRepairHistoryPath
	, coreNativeExportsPinRepairImplementation
	, coreNativeExportsPinRepairImplementationPaths
	, coreNativeExportsPinRepairIntegrationPaths
	, coreNativeExportsPinRepairPredecessor
	, coreNativeExportsPinRepairPreviousDigest
	, coreNativeExportsPinRepairRefreshedPins
	, coreNativeExportsPinRepairSourcePath
} from "../tests/helpers/core-native-exports-pin-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-native-exports-pin-repair-source-history.mjs");
assert.equal(existsSync(coreNativeExportsPinRepairHistoryPath), false
	, `${coreNativeExportsPinRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreNativeExportsPinRepairImplementation);
assert.equal(git(["rev-parse", `${coreNativeExportsPinRepairImplementation}^`])
	.trim(), coreNativeExportsPinRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreNativeExportsPinRepairPredecessor
	, coreNativeExportsPinRepairImplementation, "--"])
, [...coreNativeExportsPinRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreNativeExportsPinRepairPredecessor
	, coreNativeExportsPinRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${coreNativeExportsPinRepairImplementation}:${
		coreNativeExportsPinRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreNativeExportsPinRepairIntegrationPaths])
, [...coreNativeExportsPinRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreNativeExportsPinRepairHistoryAdditions])
, [...coreNativeExportsPinRepairHistoryAdditions].sort());

const inventoryPath = coreNativeExportsPinRepairImplementationPaths[0];
const before = git(["show"
	, `${coreNativeExportsPinRepairPredecessor}:${inventoryPath}`]);
const after = git(["show"
	, `${coreNativeExportsPinRepairImplementation}:${inventoryPath}`]);
assert.equal(after.replaceAll(coreNativeExportsPinRepairCurrentDigest
	, coreNativeExportsPinRepairPreviousDigest), before);
assert.equal(after.split(coreNativeExportsPinRepairCurrentDigest).length - 1
	, coreNativeExportsPinRepairRefreshedPins);
assert.equal(after.includes(coreNativeExportsPinRepairPreviousDigest), false);
assert.equal(sha256(await readFile(coreNativeExportsPinRepairSourcePath))
	, coreNativeExportsPinRepairCurrentDigest);
const beforeDocument = JSON.parse(before);
const afterDocument = JSON.parse(after);
assert.deepEqual(afterDocument.profiles, beforeDocument.profiles);
assert.deepEqual(afterDocument.observations, beforeDocument.observations);

const updates = [];
for(const path of coreNativeExportsPinRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreNativeExportsPinRepairPredecessor
		, coreNativeExportsPinRepairImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-native-exports-pin-repair-"));
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
	temporaryGit(["read-tree", coreNativeExportsPinRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreNativeExportsPinRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreNativeExportsPinRepairImplementation
	], { input: "Authenticate NativeExports type-surface pin repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreNativeExportsPinRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreNativeExportsPinRepairImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreNativeExportsPinRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreNativeExportsPinRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-native-exports-pin-repair-source-v1"
		, predecessorCommit: coreNativeExportsPinRepairPredecessor
		, implementationCommit: coreNativeExportsPinRepairImplementation
		, failedRun: 41066785875, failedJob: 124102407122
		, sourcePath: coreNativeExportsPinRepairSourcePath
		, previousDigest: coreNativeExportsPinRepairPreviousDigest
		, currentDigest: coreNativeExportsPinRepairCurrentDigest
		, scope: "Advance exactly 155 live type-surface citations from the authenticated pre-binder NativeExports digest to the current proof-binder implementation exposed by exact-head Core. Preserve every profile, support observation, stage, evidence identity and immutable archive while retaining the original failed run and registering a reversible transition."
		, updates, integrationUpdates, historyAdditions
		, refreshedPins: coreNativeExportsPinRepairRefreshedPins
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} pin transition, `
		+ `${integrationUpdates.length} registrations and `
		+ `${coreNativeExportsPinRepairRefreshedPins} live pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
