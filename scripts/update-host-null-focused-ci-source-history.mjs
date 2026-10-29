#!/usr/bin/env node
/**
 * Record the bounded HostNull producer and exact-run receipt.
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
	hostNullFocusedCiHistoryAdditions, hostNullFocusedCiHistoryPath
	, hostNullFocusedCiImplementation, hostNullFocusedCiImplementationAdditions
	, hostNullFocusedCiImplementationPaths, hostNullFocusedCiIntegrationPaths
	, hostNullFocusedCiPredecessor
} from "../tests/helpers/host-null-focused-ci-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-focused-ci-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullFocusedCiImplementation);
assert.equal(git(["rev-parse", `${hostNullFocusedCiImplementation}^`]).trim()
	, hostNullFocusedCiPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullFocusedCiPredecessor, hostNullFocusedCiImplementation, "--"])
, [...hostNullFocusedCiImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullFocusedCiPredecessor, hostNullFocusedCiImplementation, "--"])
, [...hostNullFocusedCiImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullFocusedCiImplementation}:${hostNullFocusedCiHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullFocusedCiIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullFocusedCiHistoryAdditions])
, [...hostNullFocusedCiHistoryAdditions].sort());

const updates = [];
for(const path of hostNullFocusedCiImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, hostNullFocusedCiPredecessor, hostNullFocusedCiImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const implementationSources = hostNullFocusedCiImplementationAdditions.map(
	path => ({
		path
		, sha256: sha256(git([
			"show", `${hostNullFocusedCiImplementation}:${path}`
		]))
	})
);

const inventory = JSON.parse(git([
	"show", `${hostNullFocusedCiImplementation}:${inventoryPath}`
]));
const changedPaths = [...new Set([
	...hostNullFocusedCiImplementationPaths
	, ...hostNullFocusedCiImplementationAdditions
	, ...hostNullFocusedCiIntegrationPaths
	, ...hostNullFocusedCiHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
const currentDigests = new Map();
for(const path of currentSourcePaths)
	currentDigests.set(path, sha256(await readFile(path)));
const reconciled = currentDigests.size === 0
	? { inventory, refreshed: 0 }
	: reconcileDependentCheckedRecordSourcePins(inventory, currentDigests);
assert.equal(reconciled.refreshed, 0);
assert.deepEqual(reconciled.inventory, inventory);

const directory = await mkdtemp(join(tmpdir(), "lean-host-null-focused-ci-"));
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
	temporaryGit(["read-tree", hostNullFocusedCiImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullFocusedCiIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", hostNullFocusedCiImplementation
	], { input: "Authenticate focused HostNull CI\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullFocusedCiIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullFocusedCiImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const additions = [];
	for(const path of hostNullFocusedCiHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, hostNullFocusedCiImplementation, "--", path]).trim(), "", path);
		additions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(hostNullFocusedCiHistoryPath, canonicalJson({
		schemaVersion: 1, milestone: "host-null-focused-ci-source-v1"
		, predecessorCommit: hostNullFocusedCiPredecessor
		, implementationCommit: hostNullFocusedCiImplementation
		, scope: "Expose the complete explicit HostNull matrix as a bounded focused producer without changing the low-cost recurring audit. Reuse four established workflow groups to emit seven independently checked artifacts across seventeen profiles, two author routes and five runtime positions. Reconcile all 170 exact package-receipt-bound cells into one same-run fail-closed receipt, preserve partial diagnostics without accepting them, and make no support promotion before hosted evidence is retained and independently replayed."
		, calledWorkflowCount: 4, producerArtifactCount: 7
		, receiptJobCount: 1, profileCount: 17, routeCount: 2
		, positionCount: 5, cellCount: 170
		, implementationAdditions: implementationSources
		, updates, integrationUpdates, currentSourcePaths
		, currentSourceDigests: currentSourcePaths.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
		, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${implementationSources.length} implementation additions, `
		+ `${integrationUpdates.length} registrations and `
		+ `${reconciled.refreshed} live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
