#!/usr/bin/env node
/**
 * Record the current live-source inventory audit repair.
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
	assertCurrentLiveSourceInventoryAudit
	, currentLiveSourceInventoryAuditHistoryAdditions
	, currentLiveSourceInventoryAuditHistoryPath
	, currentLiveSourceInventoryAuditImplementation
	, currentLiveSourceInventoryAuditImplementationPaths
	, currentLiveSourceInventoryAuditIntegrationPaths
	, currentLiveSourceInventoryAuditPredecessor
} from "../tests/helpers/current-live-source-inventory-audit-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-current-live-source-inventory-audit-source-history.mjs");
assert.equal(existsSync(currentLiveSourceInventoryAuditHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, currentLiveSourceInventoryAuditImplementation);
assert.equal(git(["rev-parse"
	, `${currentLiveSourceInventoryAuditImplementation}^`]).trim()
, currentLiveSourceInventoryAuditPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, currentLiveSourceInventoryAuditPredecessor
	, currentLiveSourceInventoryAuditImplementation, "--"])
, [...currentLiveSourceInventoryAuditImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...currentLiveSourceInventoryAuditIntegrationPaths])
, [...currentLiveSourceInventoryAuditIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...currentLiveSourceInventoryAuditHistoryAdditions])
, [...currentLiveSourceInventoryAuditHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${currentLiveSourceInventoryAuditImplementation}:${
		currentLiveSourceInventoryAuditHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSource = path => git(["show"
	, `${currentLiveSourceInventoryAuditImplementation}:${path}`]);
assertCurrentLiveSourceInventoryAudit(implementationSource(
	currentLiveSourceInventoryAuditImplementationPaths[0]));

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	currentLiveSourceInventoryAuditPredecessor
	, currentLiveSourceInventoryAuditImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of currentLiveSourceInventoryAuditImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, currentLiveSourceInventoryAuditPredecessor
		, currentLiveSourceInventoryAuditImplementation));

const directory = await mkdtemp(join(
	tmpdir(), "lean-current-live-source-audit-history-"));
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
	temporaryGit(["read-tree", currentLiveSourceInventoryAuditImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...currentLiveSourceInventoryAuditIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", currentLiveSourceInventoryAuditImplementation
	], { input: "Authenticate current live-source inventory audit\n" }).trim();
	const integrationUpdates = [];
	for(const path of currentLiveSourceInventoryAuditIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, currentLiveSourceInventoryAuditImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of currentLiveSourceInventoryAuditHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(currentLiveSourceInventoryAuditHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "current-live-source-inventory-audit-v1"
			, predecessorCommit: currentLiveSourceInventoryAuditPredecessor
			, implementationCommit: currentLiveSourceInventoryAuditImplementation
			, integrationCommit
			, discovery: {
				gate: "all current live-source pins match in one complete pass"
				, partition: "tests/checked-javascript-partition-11.test.mjs"
				, path: ".github/workflows/consumer-matrix.yml"
				, actual: "7e842a6dd36ee897a3defaaa40546ed7079c37ac4b85511839a947818798badd"
				, staleExpected: "83d38737fa631ff9fbbd5b6079ca0b62a986bf703c8313df825043610ea098c2"
			}
			, rootCause: "The current-state audit loaded docs/type-surface.v1.json from the earlier final-live-source repair commit, then compared those frozen expectations with current worktree bytes. Every later authenticated workflow change therefore appeared stale even when the current inventory was exact."
			, repair: {
				inventory: "docs/type-surface.v1.json"
				, selection: "current worktree"
				, liveFiles: 2661, missingFiles: 0, mismatches: 0
			}
			, exactModel: {
				sha256: sha256(exactModels[0])
				, bytes: Buffer.byteLength(exactModels[0])
				, cells: exact.model.length, stageEntries: exact.stageEntries
			}
			, changedSupportCells: 0, runtimeSemanticChanges: 0
			, updates, integrationUpdates, historyAdditions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "current live-source inventory audit.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
