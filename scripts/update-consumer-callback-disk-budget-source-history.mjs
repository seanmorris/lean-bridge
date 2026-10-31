#!/usr/bin/env node
/**
 * Record the complete callback-result package disk-budget repair.
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
	consumerCallbackDiskBudgetHistoryAdditions
	, consumerCallbackDiskBudgetHistoryPath
	, consumerCallbackDiskBudgetImplementation
	, consumerCallbackDiskBudgetImplementationAdditions
	, consumerCallbackDiskBudgetImplementationPaths
	, consumerCallbackDiskBudgetIntegrationPaths
	, consumerCallbackDiskBudgetPredecessor
} from "../tests/helpers/consumer-callback-disk-budget-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-callback-disk-budget-source-history.mjs");
assert.equal(existsSync(consumerCallbackDiskBudgetHistoryPath), false
	, consumerCallbackDiskBudgetHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerCallbackDiskBudgetImplementation);
assert.equal(git(["rev-parse"
	, consumerCallbackDiskBudgetImplementation + "^"]).trim()
, consumerCallbackDiskBudgetPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerCallbackDiskBudgetPredecessor
	, consumerCallbackDiskBudgetImplementation, "--"])
, [...consumerCallbackDiskBudgetImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerCallbackDiskBudgetPredecessor
	, consumerCallbackDiskBudgetImplementation, "--"])
, [...consumerCallbackDiskBudgetImplementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, consumerCallbackDiskBudgetImplementation + ":"
		+ consumerCallbackDiskBudgetHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerCallbackDiskBudgetIntegrationPaths])
, [...consumerCallbackDiskBudgetIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerCallbackDiskBudgetHistoryAdditions])
, [...consumerCallbackDiskBudgetHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const before = git(["show"
	, consumerCallbackDiskBudgetPredecessor + ":" + inventoryPath]);
const after = git(["show"
	, consumerCallbackDiskBudgetImplementation + ":" + inventoryPath]);
const currentSourcePins = [];
let restored = after;
for(const path of [
	".github/workflows/consumer-matrix.yml", "tests/documentation.test.mjs"
]) {
	const previous = sha256(git(["show"
		, consumerCallbackDiskBudgetPredecessor + ":" + path]));
	const current = sha256(git(["show"
		, consumerCallbackDiskBudgetImplementation + ":" + path]));
	const count = after.split(current).length - 1;
	assert.ok(count > 0, path);
	assert.equal(after.includes(previous), false, path);
	restored = restored.replaceAll(current, previous);
	currentSourcePins.push({ path, count, previous, current });
}
assert.equal(restored, before);
const refreshedCitationCount = currentSourcePins
	.reduce((total, pin) => total + pin.count, 0);
assert.equal(refreshedCitationCount, 117);
const inventory = JSON.parse(after);
const typeSurfaceCounts = Object.fromEntries([
	"evidence", "observations", "paths", "positions", "profiles", "stages"
].map(key => [key, inventory[key].length]));

const workflow = await readFile(
	".github/workflows/consumer-matrix.yml", "utf8");
const starts = [...workflow.matchAll(/^ {2}([a-z][a-z0-9-]*):\n/gmu)]
	.map(match => ({ id: match[1], index: match.index }));
const jobs = starts.map((start, index) => [start.id
	, workflow.slice(start.index, starts[index + 1]?.index ?? workflow.length)]);
const expectedCallbackJobIds = [
	"owned-dotnet-callback-results", "owned-perl-callback-results"
	, "owned-jvm-callback-results", "owned-ruby-callback-results"
	, "owned-python-callback-results", "owned-rust-callback-results"
	, "owned-cpp-callback-results", "owned-callback-results"
];
const callbackJobs = jobs.filter(([, body]) =>
	body.includes("name: Callback-result lifetimes in installed"));
assert.deepEqual(callbackJobs.map(([id]) => id), expectedCallbackJobIds);
const cleanup = "Free hosted runner disk before callback package builds";
const command = "sudo rm -rf /usr/share/dotnet /usr/local/lib/android /opt/ghc /usr/local/.ghcup /opt/hostedtoolcache/CodeQL";
for(const [id, body] of callbackJobs)
{
	assert.equal(body.split(cleanup).length - 1, 1, id);
	assert.equal(body.split(command).length - 1, 1, id);
	assert.ok(body.indexOf(cleanup)
		< body.indexOf("Check out the exact revision"), id);
}

const updates = [];
for(const path of consumerCallbackDiskBudgetImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerCallbackDiskBudgetPredecessor
		, consumerCallbackDiskBudgetImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const implementationAdditions = [];
for(const path of consumerCallbackDiskBudgetImplementationAdditions)
	implementationAdditions.push({ path
		, sha256: sha256(git(["show"
			, consumerCallbackDiskBudgetImplementation + ":" + path])) });
const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-callback-disk-budget-"));
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
	temporaryGit(["read-tree", consumerCallbackDiskBudgetImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerCallbackDiskBudgetIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", consumerCallbackDiskBudgetImplementation
	], { input: "Authenticate callback package disk budget\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerCallbackDiskBudgetIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerCallbackDiskBudgetImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of consumerCallbackDiskBudgetHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(consumerCallbackDiskBudgetHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "consumer-callback-disk-budget-source-v1"
		, predecessorCommit: consumerCallbackDiskBudgetPredecessor
		, implementationCommit: consumerCallbackDiskBudgetImplementation
		, failedRun: { workflow: 41170510578, job: 124447261049 }
		, failure: "hosted runner ENOSPC"
		, failedAt: "2026-10-31T05:45:02Z"
		, failedStep: "Verify .NET callback-result lifetimes"
		, callbackJobs: callbackJobs.length
		, callbackJobIds: callbackJobs.map(([id]) => id)
		, diskCleanupBeforeCheckout: true
		, scope: "Inventory all eight callback-result package jobs. Reclaim only unused hosted-image toolchains before checkout and before those jobs reinstall their exact language SDKs. Aggregate inventory, count, command and ordering mismatches so one stale job cannot hide the rest. Refresh exactly 117 source citations; preserve every type-surface observation, evidence identity and exact #1220 cell/stage contract."
		, refreshedCitationCount, currentSourcePins
		, semanticChanges: 0, typeSurfaceCounts, updates
		, implementationAdditions, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions, 8 callback jobs and 117 pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
