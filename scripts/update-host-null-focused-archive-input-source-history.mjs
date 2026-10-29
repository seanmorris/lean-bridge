#!/usr/bin/env node
/**
 * Record focused HostNull hosted-input acquisition and selection.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { dependentCheckedRecordPromotionCurrentSourcePaths }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	hostNullFocusedArchiveInputHistoryAdditions
	, hostNullFocusedArchiveInputHistoryPath
	, hostNullFocusedArchiveInputImplementation
	, hostNullFocusedArchiveInputImplementationPaths
	, hostNullFocusedArchiveInputIntegrationPaths
	, hostNullFocusedArchiveInputPredecessor
} from "../tests/helpers/host-null-focused-archive-input-source-history.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-host-null-focused-archive-input-source-history.mjs");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, hostNullFocusedArchiveInputImplementation);
assert.equal(git([
	"rev-parse", `${hostNullFocusedArchiveInputImplementation}^`
]).trim(), hostNullFocusedArchiveInputPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, hostNullFocusedArchiveInputPredecessor
	, hostNullFocusedArchiveInputImplementation, "--"])
, [...hostNullFocusedArchiveInputImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, hostNullFocusedArchiveInputPredecessor
	, hostNullFocusedArchiveInputImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${hostNullFocusedArchiveInputImplementation}:${hostNullFocusedArchiveInputHistoryPath}`]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...hostNullFocusedArchiveInputIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...hostNullFocusedArchiveInputHistoryAdditions])
, [...hostNullFocusedArchiveInputHistoryAdditions].sort());

const updates = [];
for(const path of hostNullFocusedArchiveInputImplementationPaths)
	updates.push(await gitSourceHistoryTransition(
		path, hostNullFocusedArchiveInputPredecessor
		, hostNullFocusedArchiveInputImplementation
		, { maximumEditBytes: 32 * 1024 * 1024 }
	));
const inventory = JSON.parse(git([
	"show", `${hostNullFocusedArchiveInputImplementation}:${inventoryPath}`
]));
const changedPaths = [...new Set([
	...hostNullFocusedArchiveInputImplementationPaths
	, ...hostNullFocusedArchiveInputIntegrationPaths
	, ...hostNullFocusedArchiveInputHistoryAdditions
])].sort();
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	inventory, changedPaths).sort();
assert.deepEqual(currentSourcePaths, []);

const directory = await mkdtemp(join(
	tmpdir(), "lean-host-null-focused-archive-input-"));
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
	temporaryGit(["read-tree", hostNullFocusedArchiveInputImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...hostNullFocusedArchiveInputIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", hostNullFocusedArchiveInputImplementation
	], { input: "Authenticate focused HostNull archive inputs\n" }).trim();
	const integrationUpdates = [];
	for(const path of hostNullFocusedArchiveInputIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, hostNullFocusedArchiveInputImplementation, integrationCommit
			, { maximumEditBytes: 32 * 1024 * 1024 }
		));
	const additions = [];
	for(const path of hostNullFocusedArchiveInputHistoryAdditions)
	{
		assert.equal(git(["ls-tree", "--name-only"
			, hostNullFocusedArchiveInputImplementation, "--", path]).trim()
		, "", path);
		additions.push({ path, sha256: sha256(await readFile(path)) });
	}
	await writeFile(hostNullFocusedArchiveInputHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "host-null-focused-archive-input-source-v1"
		, predecessorCommit: hostNullFocusedArchiveInputPredecessor
		, implementationCommit: hostNullFocusedArchiveInputImplementation
		, scope: "Extend complete HostNull acquisition from the legacy broad consumer workflow to the bounded focused producer without weakening either identity contract. Require exact focused nested job names, seven exact artifacts from six producer jobs, one intentionally shared native PHP/PHP-Wasm job, distinct identities for every other lane, and the expanded producer source closure before any hosted bytes can enter the immutable archive."
		, legacyArtifactCount: 7, focusedArtifactCount: 7
		, focusedProducerJobCount: 6, profileCount: 17, cellCount: 170
		, updates, integrationUpdates, currentSourcePaths
		, refreshedPins: 0, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} registrations and 0 live pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
