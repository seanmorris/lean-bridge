#!/usr/bin/env node
/**
 * Record the optional-parameter route-binder repair.
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
	optionalParameterRouteBinderRepairHistoryAdditions
	, optionalParameterRouteBinderRepairHistoryPath
	, optionalParameterRouteBinderRepairImplementation
	, optionalParameterRouteBinderRepairImplementationAdditions
	, optionalParameterRouteBinderRepairImplementationCommits
	, optionalParameterRouteBinderRepairImplementationPaths
	, optionalParameterRouteBinderRepairIntegrationPaths
	, optionalParameterRouteBinderRepairPredecessor
} from "../tests/helpers/optional-parameter-route-binder-repair-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-optional-parameter-route-binder-repair-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, optionalParameterRouteBinderRepairImplementation);
assert.deepEqual(git(["rev-list", "--reverse"
	, `${optionalParameterRouteBinderRepairPredecessor}..`
		+ optionalParameterRouteBinderRepairImplementation])
	.trim().split("\n")
, [...optionalParameterRouteBinderRepairImplementationCommits]);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, optionalParameterRouteBinderRepairPredecessor
	, optionalParameterRouteBinderRepairImplementation, "--"])
, [...optionalParameterRouteBinderRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, optionalParameterRouteBinderRepairPredecessor
	, optionalParameterRouteBinderRepairImplementation, "--"])
, [...optionalParameterRouteBinderRepairImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${optionalParameterRouteBinderRepairImplementation}`
		+ `:${optionalParameterRouteBinderRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...optionalParameterRouteBinderRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...optionalParameterRouteBinderRepairHistoryAdditions])
, [...optionalParameterRouteBinderRepairHistoryAdditions].sort());

const updates = [];
for(const path of optionalParameterRouteBinderRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, optionalParameterRouteBinderRepairPredecessor
		, optionalParameterRouteBinderRepairImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const changedPaths = [...new Set([
	...optionalParameterRouteBinderRepairImplementationPaths
	, ...optionalParameterRouteBinderRepairImplementationAdditions
	, ...optionalParameterRouteBinderRepairIntegrationPaths
	, ...optionalParameterRouteBinderRepairHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, []);

const directory = await mkdtemp(join(
	tmpdir(), "lean-optional-route-binder-repair-"));
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
	temporaryGit(["read-tree", optionalParameterRouteBinderRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...optionalParameterRouteBinderRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", optionalParameterRouteBinderRepairImplementation
	], { input: "Authenticate optional route binders\n" }).trim();
	const integrationUpdates = [];
	for(const path of optionalParameterRouteBinderRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, optionalParameterRouteBinderRepairImplementation
			, integrationCommit, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const implementationAdditions = [];
	for(const path of optionalParameterRouteBinderRepairImplementationAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterRouteBinderRepairPredecessor, "--", path])
			.trim(), "", path);
		implementationAdditions.push({
			path
			, sha256: sha256(git(["show"
				, `${optionalParameterRouteBinderRepairImplementation}:${path}`]))
		});
	}
	const historyAdditions = [];
	for(const path of optionalParameterRouteBinderRepairHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, optionalParameterRouteBinderRepairImplementation, "--", path])
			.trim(), "", path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(optionalParameterRouteBinderRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "optional-parameter-route-binder-repair-source-v1"
			, predecessorCommit: optionalParameterRouteBinderRepairPredecessor
			, implementationCommit: optionalParameterRouteBinderRepairImplementation
			, implementationCommits: [
				...optionalParameterRouteBinderRepairImplementationCommits
			]
			, scope: "Repair installed optional-parameter route verification after the first complete hosted wave. Ordinary source analysis owns binder arg0; independently reviewed Binding IR owns binder value0. Apply that distinction to PHP signatures, npm Binding IR, compiler adapters and retained npm reports without widening either route or changing generated package behavior."
			, hostedRun: 40856632076
			, repairedProfiles: [
				"browser-javascript", "browser-react", "browser-worker"
				, "node-javascript", "node-typescript", "php-native", "php-wasm"
			]
			, updates, integrationUpdates, implementationAdditions
			, historyAdditions, currentSourcePaths, refreshedPins: 0
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
