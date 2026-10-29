#!/usr/bin/env node
/**
 * Record the bounded dependent-signature producer and exact-run receipt.
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
	dependentSignatureFocusedCiHistoryAdditions as historyAdditions
	, dependentSignatureFocusedCiHistoryPath as historyPath
	, dependentSignatureFocusedCiImplementation as implementation
	, dependentSignatureFocusedCiImplementationAdditions as implementationAdditions
	, dependentSignatureFocusedCiImplementationPaths as implementationPaths
	, dependentSignatureFocusedCiIntegrationPaths as integrationPaths
	, dependentSignatureFocusedCiPredecessor as predecessor
} from "../tests/helpers/dependent-signature-focused-ci-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-dependent-signature-focused-ci-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", `${implementation}^`]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation, "--"]), [...implementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, predecessor, implementation, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const implementationSources = implementationAdditions.map(path => ({
	path, sha256: sha256(git(["show", `${implementation}:${path}`]))
}));

const inventory = JSON.parse(git(["show", `${implementation}:${inventoryPath}`]));
const changedPaths = [...new Set([
	...implementationPaths, ...implementationAdditions
	, ...integrationPaths, ...historyAdditions
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

const directory = await mkdtemp(join(
	tmpdir(), "lean-dependent-signature-focused-ci-"));
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", implementation]
		, { input: "Authenticate focused dependent-signature CI\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const additions = [];
	for(const path of historyAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only", implementation, "--", path])
			.trim(), "", path);
		additions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "dependent-signature-focused-ci-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, scope: "Expose the eleven existing installed dependent checked-record workflows as reusable same-revision producers, retain their independent package checkers and complete artifacts, and preserve their weekly manual operation. Execute seventeen profiles through ordinary and reviewed author routes in both full and result-only API modes. Reconcile forty-four canonical checker summaries into one exact-run fail-closed receipt representing thirty-four promoted cells. Preserve the low-cost immutable archive audit as the default and make no support promotion before the hosted run is retained and independently replayed."
		, calledWorkflowCount: 11, producerJobCount: 11
		, receiptJobCount: 1, artifactCount: 11, reportCount: 44
		, profileCount: 17, authorRouteCount: 2, apiModeCount: 2
		, cellCount: 34
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
