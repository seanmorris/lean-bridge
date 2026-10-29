#!/usr/bin/env node
/**
 * Record the optional-parameter Perl Unicode-default repair.
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
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	optionalParameterPerlUnicodeDefaultRepairHistoryAdditions
	, optionalParameterPerlUnicodeDefaultRepairHistoryPath
	, optionalParameterPerlUnicodeDefaultRepairImplementation
	, optionalParameterPerlUnicodeDefaultRepairImplementationAdditions
	, optionalParameterPerlUnicodeDefaultRepairImplementationCommits
	, optionalParameterPerlUnicodeDefaultRepairImplementationPaths
	, optionalParameterPerlUnicodeDefaultRepairIntegrationPaths
	, optionalParameterPerlUnicodeDefaultRepairPredecessor
} from "../tests/helpers/optional-parameter-perl-unicode-default-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const sourcePins = (value, path, pins = []) => {
	if(Array.isArray(value))
		for(const item of value) sourcePins(item, path, pins);
	else if(value !== null && typeof value === "object")
	{
		if(value.path === path && typeof value.sha256 === "string")
			pins.push(value.sha256);
		for(const item of Object.values(value)) sourcePins(item, path, pins);
	}
	return pins;
};

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-perl-unicode-default-repair-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterPerlUnicodeDefaultRepairImplementation);
assert.deepEqual(git(["rev-list", "--reverse"
	, `${optionalParameterPerlUnicodeDefaultRepairPredecessor}..`
		+ optionalParameterPerlUnicodeDefaultRepairImplementation])
	.trim().split("\n")
, [...optionalParameterPerlUnicodeDefaultRepairImplementationCommits]);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterPerlUnicodeDefaultRepairPredecessor
	, optionalParameterPerlUnicodeDefaultRepairImplementation, "--"])
, [...optionalParameterPerlUnicodeDefaultRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterPerlUnicodeDefaultRepairPredecessor
	, optionalParameterPerlUnicodeDefaultRepairImplementation, "--"])
, [...optionalParameterPerlUnicodeDefaultRepairImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterPerlUnicodeDefaultRepairImplementation}`
		+ `:${optionalParameterPerlUnicodeDefaultRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"])
, [...optionalParameterPerlUnicodeDefaultRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterPerlUnicodeDefaultRepairHistoryAdditions])
, [...optionalParameterPerlUnicodeDefaultRepairHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterPerlUnicodeDefaultRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterPerlUnicodeDefaultRepairPredecessor
		, optionalParameterPerlUnicodeDefaultRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const changedPaths = [...new Set([
	...optionalParameterPerlUnicodeDefaultRepairImplementationPaths
	, ...optionalParameterPerlUnicodeDefaultRepairImplementationAdditions
	, ...optionalParameterPerlUnicodeDefaultRepairIntegrationPaths
	, ...optionalParameterPerlUnicodeDefaultRepairHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, ["src/backends/perl/generate.mjs"]);
const pinnedPath = currentSourcePaths[0];
const predecessorInventory = JSON.parse(git(["show"
	, `${optionalParameterPerlUnicodeDefaultRepairPredecessor}:${inventoryPath}`]));
const predecessorDigest = sha256(git(["show"
	, `${optionalParameterPerlUnicodeDefaultRepairPredecessor}:${pinnedPath}`]));
const implementationDigest = sha256(git(["show"
	, `${optionalParameterPerlUnicodeDefaultRepairImplementation}:${pinnedPath}`]));
const previousPins = sourcePins(predecessorInventory, pinnedPath);
const currentPins = sourcePins(inventory, pinnedPath);
assert.deepEqual([...new Set(previousPins)], [predecessorDigest]);
assert.deepEqual([...new Set(currentPins)], [implementationDigest]);
assert.equal(currentPins.length, previousPins.length);
const refreshedPins = currentPins.length;
assert.equal(refreshedPins, 15);

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-perl-unicode-default-repair-"));
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
			encoding: "utf8", maxBuffer: 256 * 1024 * 1024
			, env: environment, ...options
		}
	);
	temporaryGit(["read-tree"
		, optionalParameterPerlUnicodeDefaultRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterPerlUnicodeDefaultRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, optionalParameterPerlUnicodeDefaultRepairImplementation
	], { input: "Authenticate optional Perl Unicode defaults\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterPerlUnicodeDefaultRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterPerlUnicodeDefaultRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const implementationAdditions = [];
	for(const path of optionalParameterPerlUnicodeDefaultRepairImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterPerlUnicodeDefaultRepairPredecessor, "--", path])
			.trim(), "", path);
		implementationAdditions.push({
			path
			, sha256: sha256(git(["show"
				, `${optionalParameterPerlUnicodeDefaultRepairImplementation}:${path}`]))
		});
	}
	const historyAdditions = [];
	for(const path of optionalParameterPerlUnicodeDefaultRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterPerlUnicodeDefaultRepairImplementation, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterPerlUnicodeDefaultRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-perl-unicode-default-repair-source-v1"
			, predecessorCommit:
				optionalParameterPerlUnicodeDefaultRepairPredecessor
			, implementationCommit:
				optionalParameterPerlUnicodeDefaultRepairImplementation
			, implementationCommits: [
				...optionalParameterPerlUnicodeDefaultRepairImplementationCommits
			]
			, scope: "Repair installed Perl optional-parameter defaults after the first complete hosted wave. Generated public modules enable UTF-8 source semantics before embedding compiler-authenticated String or Char defaults, so a non-ASCII default such as lambda remains one Unicode scalar rather than two Latin-1 bytes. Preserve omission-only default insertion, explicit supplied values, the native ABI and every other package behavior."
			, hostedRun: 40856632076
			, repairedProfiles: ["perl"]
			, updates, integrationUpdates, implementationAdditions
			, historyAdditions, currentSourcePaths, refreshedPins
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and ${refreshedPins} live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
