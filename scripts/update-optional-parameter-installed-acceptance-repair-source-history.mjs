#!/usr/bin/env node
/**
 * Record the optional-parameter installed-acceptance repair.
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
	optionalParameterInstalledAcceptanceRepairHistoryAdditions
	, optionalParameterInstalledAcceptanceRepairHistoryPath
	, optionalParameterInstalledAcceptanceRepairImplementation
	, optionalParameterInstalledAcceptanceRepairImplementationAdditions
	, optionalParameterInstalledAcceptanceRepairImplementationCommits
	, optionalParameterInstalledAcceptanceRepairImplementationPaths
	, optionalParameterInstalledAcceptanceRepairIntegrationPaths
	, optionalParameterInstalledAcceptanceRepairPredecessor
} from "../tests/helpers/optional-parameter-installed-acceptance-repair-source-history.mjs";

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
	, "Usage: update-optional-parameter-installed-acceptance-repair-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterInstalledAcceptanceRepairImplementation);
assert.deepEqual(git(["rev-list", "--reverse"
	, `${optionalParameterInstalledAcceptanceRepairPredecessor}..`
		+ optionalParameterInstalledAcceptanceRepairImplementation])
	.trim().split("\n")
, [...optionalParameterInstalledAcceptanceRepairImplementationCommits]);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterInstalledAcceptanceRepairPredecessor
	, optionalParameterInstalledAcceptanceRepairImplementation, "--"])
, [...optionalParameterInstalledAcceptanceRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterInstalledAcceptanceRepairPredecessor
	, optionalParameterInstalledAcceptanceRepairImplementation, "--"])
, [...optionalParameterInstalledAcceptanceRepairImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterInstalledAcceptanceRepairImplementation}`
		+ `:${optionalParameterInstalledAcceptanceRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"])
, [...optionalParameterInstalledAcceptanceRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterInstalledAcceptanceRepairHistoryAdditions])
, [...optionalParameterInstalledAcceptanceRepairHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterInstalledAcceptanceRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterInstalledAcceptanceRepairPredecessor
		, optionalParameterInstalledAcceptanceRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const changedPaths = [...new Set([
	...optionalParameterInstalledAcceptanceRepairImplementationPaths
	, ...optionalParameterInstalledAcceptanceRepairImplementationAdditions
	, ...optionalParameterInstalledAcceptanceRepairIntegrationPaths
	, ...optionalParameterInstalledAcceptanceRepairHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, ["src/backends/c/gmp-projection.mjs"]);
const pinnedPath = currentSourcePaths[0];
const predecessorInventory = JSON.parse(git(["show"
	, `${optionalParameterInstalledAcceptanceRepairPredecessor}:${inventoryPath}`]));
const predecessorDigest = sha256(git(["show"
	, `${optionalParameterInstalledAcceptanceRepairPredecessor}:${pinnedPath}`]));
const implementationDigest = sha256(git(["show"
	, `${optionalParameterInstalledAcceptanceRepairImplementation}:${pinnedPath}`]));
const previousPins = sourcePins(predecessorInventory, pinnedPath);
const currentPins = sourcePins(inventory, pinnedPath);
assert.deepEqual([...new Set(previousPins)], [predecessorDigest]);
assert.deepEqual([...new Set(currentPins)], [implementationDigest]);
assert.equal(currentPins.length, previousPins.length);
const refreshedPins = currentPins.length;
assert.equal(refreshedPins, 8);

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-installed-acceptance-repair-"));
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
		, optionalParameterInstalledAcceptanceRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterInstalledAcceptanceRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, optionalParameterInstalledAcceptanceRepairImplementation
	], { input: "Authenticate optional installed acceptance repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterInstalledAcceptanceRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterInstalledAcceptanceRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const implementationAdditions = [];
	const addedImplementationPaths
		= optionalParameterInstalledAcceptanceRepairImplementationAdditions;
	for(const path of addedImplementationPaths)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterInstalledAcceptanceRepairPredecessor, "--", path])
			.trim(), "", path);
		implementationAdditions.push({
			path
			, sha256: sha256(git(["show"
				, `${optionalParameterInstalledAcceptanceRepairImplementation}:${path}`]))
		});
	}
	const historyAdditions = [];
	for(const path of optionalParameterInstalledAcceptanceRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterInstalledAcceptanceRepairImplementation, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterInstalledAcceptanceRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-installed-acceptance-repair-source-v1"
			, predecessorCommit:
				optionalParameterInstalledAcceptanceRepairPredecessor
			, implementationCommit:
				optionalParameterInstalledAcceptanceRepairImplementation
			, implementationCommits: [
				...optionalParameterInstalledAcceptanceRepairImplementationCommits
			]
			, scope: "Repair exact installed optional-parameter acceptance after the first complete hosted wave. Bind ordinary WIT exports to arg0 and reviewed exports to value0 while retaining seven direct and seven default signatures. Capture managed compiler diagnostics from both streams, admit both exact Kotlin null-diagnostic spellings, retain the Python wheel receipt digest beside its authenticated environment and validate every language closure as an exact schema. Preserve the ordinary C omission surface through the public GMP facade, including Nat, Int, String, Char, Bool, Unit and nested Option defaults, while keeping the full-arity ABI and distinguishing omission, Option, Unit and explicit host null."
			, hostedRun: 40856632076
			, repairedProfiles: ["c", "dotnet", "kotlin", "python", "wit-wasi"]
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
