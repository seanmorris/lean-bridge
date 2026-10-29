#!/usr/bin/env node
/**
 * Record the current-source pin repair and missing documentation transitions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	coreCurrentSourcePinRepairAddedPaths
	, coreCurrentSourcePinRepairCurrentSourcePaths
	, coreCurrentSourcePinRepairHistoryPath
	, coreCurrentSourcePinRepairImplementation
	, coreCurrentSourcePinRepairImplementationPaths
	, coreCurrentSourcePinRepairIntegrationPaths
	, coreCurrentSourcePinRepairPredecessor
	, coreCurrentSourcePinRepairPreparationCommits
	, coreCurrentSourcePinRepairPreparationPath
} from "../tests/helpers/core-current-source-pin-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-current-source-pin-repair-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreCurrentSourcePinRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, coreCurrentSourcePinRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, coreCurrentSourcePinRepairPredecessor
	, coreCurrentSourcePinRepairImplementation, "--"])
, [...coreCurrentSourcePinRepairImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${coreCurrentSourcePinRepairImplementation}:${
		coreCurrentSourcePinRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...coreCurrentSourcePinRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreCurrentSourcePinRepairAddedPaths])
, [...coreCurrentSourcePinRepairAddedPaths].sort());

const beforeInventory = JSON.parse(git(["show"
	, `${coreCurrentSourcePinRepairPredecessor}:${inventoryPath}`]));
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	beforeInventory, coreCurrentSourcePinRepairCurrentSourcePaths).sort();
assert.deepEqual(currentSourcePaths
	, coreCurrentSourcePinRepairCurrentSourcePaths);
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	beforeInventory, currentDigests);
assert.equal(reconciled.refreshed, 158);
assert.equal(JSON.stringify(reconciled.inventory, null, 2) + "\n"
	, git(["show", `${coreCurrentSourcePinRepairImplementation}:${inventoryPath}`]));

const preparationUpdates = [];
for(const item of coreCurrentSourcePinRepairPreparationCommits)
{
	assert.equal(git(["rev-parse", `${item.commit}^`]).trim()
		, item.previousCommit);
	const update = await gitSourceHistoryTransition(
		coreCurrentSourcePinRepairPreparationPath
		, item.previousCommit, item.commit
		, { maximumEditBytes: 16 * 1024 * 1024 });
	preparationUpdates.push({ commit: item.commit
		, previousCommit: item.previousCommit, ...update });
}
const implementationUpdates = [];
for(const path of coreCurrentSourcePinRepairImplementationPaths)
	implementationUpdates.push(await gitSourceHistoryTransition(path
		, coreCurrentSourcePinRepairPredecessor
		, coreCurrentSourcePinRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-current-source-pin-repair-"));
try
{
	const temporaryIndex = join(directory, "index");
	const environment = {
		...process.env, GIT_INDEX_FILE: temporaryIndex
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
	temporaryGit(["read-tree", coreCurrentSourcePinRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreCurrentSourcePinRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", coreCurrentSourcePinRepairImplementation]
		, { input: "Authenticate current-source pin repair\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of coreCurrentSourcePinRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, coreCurrentSourcePinRepairImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }));
	const additions = [];
	for(const path of coreCurrentSourcePinRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, coreCurrentSourcePinRepairImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(coreCurrentSourcePinRepairHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-current-source-pin-repair-v1"
		, predecessorCommit: coreCurrentSourcePinRepairPredecessor
		, implementationCommit: coreCurrentSourcePinRepairImplementation
		, scope: "Repair the five stale current-source identities exposed by exact-head Core without changing any support cell, observation, evidence claim or archived artifact. Authenticate the previously omitted HostNull, proof-erasure and dependent-signature documentation transitions, retain the already authenticated scripting HostNull source histories, refresh exactly 158 live pins, and register the complete repair newest-first."
		, preparationUpdates, implementationUpdates, integrationUpdates
		, additions, currentSourcePaths
		, currentSourceDigests: currentSourcePaths.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${preparationUpdates.length} preparation, `
		+ `${implementationUpdates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
