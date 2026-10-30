#!/usr/bin/env node
/**
 * Record the complete current-source pin closure exposed by final Core.
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
	coreCurrentSourceClosureRepairHistoryAdditions
	, coreCurrentSourceClosureRepairHistoryPath
	, coreCurrentSourceClosureRepairImplementation
	, coreCurrentSourceClosureRepairImplementationPaths
	, coreCurrentSourceClosureRepairIntegrationPaths
	, coreCurrentSourceClosureRepairPinTransitions
	, coreCurrentSourceClosureRepairPredecessor
	, coreCurrentSourceClosureRepairRefreshedPins
} from "../tests/helpers/core-current-source-closure-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-current-source-closure-repair-source-history.mjs");
assert.equal(existsSync(coreCurrentSourceClosureRepairHistoryPath), false
	, `${coreCurrentSourceClosureRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreCurrentSourceClosureRepairImplementation);
assert.equal(git(["rev-parse", `${coreCurrentSourceClosureRepairImplementation}^`])
	.trim(), coreCurrentSourceClosureRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreCurrentSourceClosureRepairPredecessor
	, coreCurrentSourceClosureRepairImplementation, "--"])
, [...coreCurrentSourceClosureRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreCurrentSourceClosureRepairPredecessor
	, coreCurrentSourceClosureRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${coreCurrentSourceClosureRepairImplementation}:${
		coreCurrentSourceClosureRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreCurrentSourceClosureRepairIntegrationPaths])
, [...coreCurrentSourceClosureRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreCurrentSourceClosureRepairHistoryAdditions])
, [...coreCurrentSourceClosureRepairHistoryAdditions].sort());

const inventoryPath = coreCurrentSourceClosureRepairImplementationPaths[0];
const before = git(["show"
	, `${coreCurrentSourceClosureRepairPredecessor}:${inventoryPath}`]);
const after = git(["show"
	, `${coreCurrentSourceClosureRepairImplementation}:${inventoryPath}`]);
let restored = after;
for(const transition of coreCurrentSourceClosureRepairPinTransitions)
{
	assert.equal(sha256(await readFile(transition.path))
		, transition.currentSha256, transition.path);
	assert.equal(restored.includes(transition.previousSha256), false
		, transition.path);
	assert.equal(restored.split(transition.currentSha256).length - 1
		, transition.count, transition.path);
	restored = restored.replaceAll(transition.currentSha256
		, transition.previousSha256);
}
assert.equal(restored, before);
assert.equal(coreCurrentSourceClosureRepairPinTransitions
	.reduce((sum, item) => sum + item.count, 0)
, coreCurrentSourceClosureRepairRefreshedPins);
const beforeDocument = JSON.parse(before);
const afterDocument = JSON.parse(after);
assert.deepEqual(afterDocument.profiles, beforeDocument.profiles);
assert.deepEqual(afterDocument.observations, beforeDocument.observations);

const updates = [];
for(const path of coreCurrentSourceClosureRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreCurrentSourceClosureRepairPredecessor
		, coreCurrentSourceClosureRepairImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-current-source-closure-repair-"));
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
	temporaryGit(["read-tree", coreCurrentSourceClosureRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreCurrentSourceClosureRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreCurrentSourceClosureRepairImplementation
	], { input: "Authenticate remaining current-source pin closure\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreCurrentSourceClosureRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreCurrentSourceClosureRepairImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreCurrentSourceClosureRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreCurrentSourceClosureRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-current-source-closure-repair-v1"
		, predecessorCommit: coreCurrentSourceClosureRepairPredecessor
		, implementationCommit: coreCurrentSourceClosureRepairImplementation
		, failedRun: 41066785875, failedJob: 124102407122
		, scope: "Close the complete materialized live-source identity set after exact-head Core exposed the first stale NativeExports citation. Advance exactly 1,135 citations across nine already-authenticated WIT, JVM, PHP-Wasm, optional-parameter and dependent-signature sources. Preserve every profile, support observation, stage, evidence identity and immutable archive, retain the failed run, and register a reversible transition."
		, pinTransitions: coreCurrentSourceClosureRepairPinTransitions
		, updates, integrationUpdates, historyAdditions
		, refreshedPins: coreCurrentSourceClosureRepairRefreshedPins
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} closure transition, `
		+ `${integrationUpdates.length} registrations and `
		+ `${coreCurrentSourceClosureRepairRefreshedPins} live pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
