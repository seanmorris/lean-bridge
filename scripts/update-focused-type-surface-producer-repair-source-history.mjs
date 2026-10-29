#!/usr/bin/env node
/**
 * Record the focused type-surface producer repair and refresh only its live
 * source identities.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	focusedTypeSurfaceProducerRepairAddedPaths
	, focusedTypeSurfaceProducerRepairHistoryPath
	, focusedTypeSurfaceProducerRepairImplementation
	, focusedTypeSurfaceProducerRepairImplementationPaths
	, focusedTypeSurfaceProducerRepairIntegrationPaths
	, focusedTypeSurfaceProducerRepairPredecessor
} from "../tests/helpers/focused-type-surface-producer-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-focused-type-surface-producer-repair-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, focusedTypeSurfaceProducerRepairImplementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim()
	, focusedTypeSurfaceProducerRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, focusedTypeSurfaceProducerRepairPredecessor
	, focusedTypeSurfaceProducerRepairImplementation, "--"])
, [...focusedTypeSurfaceProducerRepairImplementationPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${focusedTypeSurfaceProducerRepairImplementation}:${
		focusedTypeSurfaceProducerRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0, "Never rewrite committed history");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, focusedTypeSurfaceProducerRepairIntegrationPaths
		.filter(path => path !== inventoryPath).sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...focusedTypeSurfaceProducerRepairAddedPaths])
, [...focusedTypeSurfaceProducerRepairAddedPaths].sort());

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const changedPaths = [...new Set([
	...focusedTypeSurfaceProducerRepairImplementationPaths
	, ...focusedTypeSurfaceProducerRepairIntegrationPaths
	, ...focusedTypeSurfaceProducerRepairAddedPaths
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.ok(currentSourcePaths.length > 0);
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	inventory, currentDigests);
assert.ok(reconciled.refreshed > 0);
await writeFile(inventoryPath
	, JSON.stringify(reconciled.inventory, null, 2) + "\n");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...focusedTypeSurfaceProducerRepairIntegrationPaths].sort());

const updates = [];
for(const path of focusedTypeSurfaceProducerRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, focusedTypeSurfaceProducerRepairPredecessor
		, focusedTypeSurfaceProducerRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-focused-type-surface-producer-repair-"));
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
	temporaryGit(["read-tree", focusedTypeSurfaceProducerRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...focusedTypeSurfaceProducerRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p"
			, focusedTypeSurfaceProducerRepairImplementation]
		, { input: "Authenticate focused type-surface producer repair\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of focusedTypeSurfaceProducerRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, focusedTypeSurfaceProducerRepairImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }));
	const additions = [];
	for(const path of focusedTypeSurfaceProducerRepairAddedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, focusedTypeSurfaceProducerRepairImplementation, "--", path])
			.trim(), "", path);
		additions.push({ path, currentSha256: sha256(await readFile(path)) });
	}
	await writeFile(focusedTypeSurfaceProducerRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "focused-type-surface-producer-repair-source-v1"
			, predecessorCommit: focusedTypeSurfaceProducerRepairPredecessor
			, implementationCommit: focusedTypeSurfaceProducerRepairImplementation
			, scope: "Repair the focused optional-parameter producer failures at their actual boundaries: pass ecosystem targets rather than profile labels, retain compiler-owned optional/default fields in the native model, and close the filtered component-engine source set over its imported default-value validator. Apply the same target correction before proof-erasure and managed HostNull producers run. Add direct regression controls, refresh only affected live source identities, and change no support cell or hosted observation."
			, updates, integrationUpdates, additions
			, currentSourcePaths
			, currentSourceDigests: currentSourcePaths.map(path => ({
				path, sha256: currentDigests.get(path)
			}))
			, refreshedPins: reconciled.refreshed
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${reconciled.refreshed} live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
