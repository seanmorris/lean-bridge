#!/usr/bin/env node
/**
 * Record the complete HostNull verifier lint and live-pin repair.
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
	hostNullCompleteStaticRepairHistoryAdditions
	, hostNullCompleteStaticRepairHistoryPath
	, hostNullCompleteStaticRepairImplementation
	, hostNullCompleteStaticRepairImplementationPaths
	, hostNullCompleteStaticRepairIntegrationPaths
	, hostNullCompleteStaticRepairPredecessor
} from "../tests/helpers/host-null-complete-static-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-complete-static-repair-source-history.mjs");
assert.equal(existsSync(hostNullCompleteStaticRepairHistoryPath), false
	, `${hostNullCompleteStaticRepairHistoryPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullCompleteStaticRepairImplementation);
const parent = git(["rev-parse"
	, `${hostNullCompleteStaticRepairImplementation}^`]).trim();
assert.equal(parent, hostNullCompleteStaticRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullCompleteStaticRepairPredecessor
	, hostNullCompleteStaticRepairImplementation, "--"])
, [...hostNullCompleteStaticRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullCompleteStaticRepairPredecessor
	, hostNullCompleteStaticRepairImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullCompleteStaticRepairImplementation}:${hostNullCompleteStaticRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...hostNullCompleteStaticRepairIntegrationPaths])
, [...hostNullCompleteStaticRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullCompleteStaticRepairHistoryAdditions])
, [...hostNullCompleteStaticRepairHistoryAdditions].sort());

const updates = [];
for(const path of hostNullCompleteStaticRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, hostNullCompleteStaticRepairPredecessor
		, hostNullCompleteStaticRepairImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-complete-static-repair-"));
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
	temporaryGit(["read-tree", hostNullCompleteStaticRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullCompleteStaticRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", hostNullCompleteStaticRepairImplementation
	], { input: "Authenticate complete HostNull static repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullCompleteStaticRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullCompleteStaticRepairImplementation, integrationCommit
			, { maximumEditBytes: 16 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of hostNullCompleteStaticRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(hostNullCompleteStaticRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-complete-static-repair-source-v1"
		, predecessorCommit: hostNullCompleteStaticRepairPredecessor
		, implementationCommit: hostNullCompleteStaticRepairImplementation
		, failedRun: 41065734932, failedJob: 124096528010
		, scope: "Correct the one Allman closing-rail lint defect introduced while making complete HostNull archive cell comparison order-independent. Preserve verifier behavior and the immutable seven-lane archive, advance exactly one live evidence-file digest, and keep all 1,054 VO #1220 cells and 5,270 stage entries unchanged."
		, updates, integrationUpdates, historyAdditions, refreshedPins: 1
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} static repair transitions, `
		+ `${integrationUpdates.length} registrations and one live pin.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
