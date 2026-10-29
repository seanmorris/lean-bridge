#!/usr/bin/env node
/**
 * Record the two-parent optional-parameter merge, refresh only affected live
 * source pins, and authenticate the newest-first history-hub registration.
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

const mergeCommit = "a30d28953643fef04073e3fb9ccab53b74d720d7";
const currentParent = "4c5f13b6b6c84ba7f463e52538fbf86cfd18830c";
const optionalParent = "3cb418f0506873e33f0206a6ac662dd713d418c2";
const optionalHistoryPath
	= "docs/evidence/optional-parameter-source-history-20261028.json";
const historyPath
	= "docs/evidence/optional-parameter-current-line-integration-source-history-20261029.json";
const inventoryPath = "docs/type-surface.v1.json";
const optionalParentPaths = [
	"tests/checked-javascript-partition-11.test.mjs"
	, "tests/helpers/fin-refinement-source-history.mjs"
];
const integrationPaths = [...optionalParentPaths
	, "tests/perl-contract.test.mjs"
	, "nix/perl-engine-source-boundary.json"];
const addedPaths = [
	"scripts/update-optional-parameter-current-line-integration-source-history.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history-tests.mjs"
	, "tests/helpers/optional-parameter-current-line-integration-source-history.mjs"
];
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-current-line-integration-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim(), mergeCommit);
assert.equal(git(["show", "-s", "--format=%P", mergeCommit]).trim()
	, `${currentParent} ${optionalParent}`);
assert.doesNotThrow(() => execFileSync("git"
	, ["diff", "--cached", "--quiet", "HEAD", "--"]));
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M", "--"])
	, [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...addedPaths]), [...addedPaths].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${mergeCommit}:${historyPath}`], { stdio: "ignore" }).status, 0);

const currentPaths = names(["diff", "--name-only", "--diff-filter=M"
	, currentParent, mergeCommit, "--"]);
assert.equal(currentPaths.length, 47);
const currentParentUpdates = [];
for(const path of currentPaths)
	currentParentUpdates.push(await gitSourceHistoryTransition(
		path, currentParent, mergeCommit, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const optionalParentUpdates = [];
for(const path of optionalParentPaths)
	optionalParentUpdates.push(await gitSourceHistoryTransition(
		path, optionalParent, mergeCommit, { maximumEditBytes: 32 * 1024 * 1024 }
	));

const optionalHistory = JSON.parse(await readFile(optionalHistoryPath, "utf8"));
const optionalExpectedDigests = optionalHistory.integrationUpdates.map(update => ({
	path: update.path
	, digests: [...new Set([update.previousSha256, update.currentSha256])].sort()
}));
assert.deepEqual(optionalExpectedDigests.map(item => item.path)
	, optionalParentPaths);

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const changedPaths = [...new Set([...currentPaths, ...integrationPaths
	, ...addedPaths])].sort();
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

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-current-line-integration-"));
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
	temporaryGit(["read-tree", mergeCommit]);
	temporaryGit(["add", "--sparse", "--", inventoryPath, ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit(
		["commit-tree", tree, "-p", mergeCommit]
		, { input: "Authenticate optional-parameter current-line integration\n" }
	).trim();
	const integrationUpdates = [];
	for(const path of [inventoryPath, ...integrationPaths])
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, mergeCommit, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const additions = [];
	for(const path of addedPaths)
	{
		assert.equal(git(["ls-tree", "--name-only", mergeCommit, "--", path])
			.trim(), "", path);
		additions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "optional-parameter-current-line-integration-source-v1"
		, mergeCommit, currentParent, optionalParent
		, optionalHistoryPath
		, scope: "Preserve the sealed 34-cell optional-parameter implementation as one exact merge parent while retaining the newer proof-erasure, dependent-signature and HostNull source line as the other. Reconstruct either lineage without weakening exact source identities; make the Perl workflow contract require all three independently enforced soft-qualified gates; close the Nix/CPAN source boundary over every optional-default module reachable by its filtered project; refresh only existing live-source hashes and change no support claim, observation or immutable hosted artifact."
		, currentParentUpdates, optionalParentUpdates
		, optionalExpectedDigests, integrationUpdates
		, currentSourcePaths
		, currentSourceDigests: currentSourcePaths.map(path => ({
			path, sha256: currentDigests.get(path)
		}))
		, refreshedPins: reconciled.refreshed
		, additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${currentParentUpdates.length} current-parent transitions, `
		+ `${optionalParentUpdates.length} optional-parent transitions, `
		+ `${integrationUpdates.length} registrations and ${reconciled.refreshed} live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
