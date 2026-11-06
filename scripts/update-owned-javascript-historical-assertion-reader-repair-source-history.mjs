#!/usr/bin/env node
/**
 * Record the owned JavaScript historical-assertion reader repair.
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
import {
	assertOwnedJavaScriptHistoricalAssertionReaderRepair
	, ownedJavaScriptHistoricalAssertionReaderRepairBehavior as behavior
	, ownedJavaScriptHistoricalAssertionReaderRepairHistoryAdditions as historyAdditions
	, ownedJavaScriptHistoricalAssertionReaderRepairHistoryPath as historyPath
	, ownedJavaScriptHistoricalAssertionReaderRepairImplementation as implementation
	, ownedJavaScriptHistoricalAssertionReaderRepairImplementationPaths as implementationPaths
	, ownedJavaScriptHistoricalAssertionReaderRepairIntegrationPaths as integrationPaths
	, ownedJavaScriptHistoricalAssertionReaderRepairPredecessor as predecessor
} from "../tests/helpers/owned-javascript-historical-assertion-reader-repair-source-history.mjs";
import {
	nativeSubtypeResultProjectionRepairHistoryPath
} from "../tests/helpers/native-subtype-result-projection-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-owned-javascript-historical-assertion-reader-repair-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation
	, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...integrationPaths]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const implementationSources = Object.fromEntries(implementationPaths.map(
	path => [path, blob(implementation, path)]));
assert.deepEqual(assertOwnedJavaScriptHistoricalAssertionReaderRepair(
	implementationSources), behavior);

const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
assert.deepEqual({
	sha256: sha256(exactSources[0]), bytes: Buffer.byteLength(exactSources[0])
	, cells: exact.model.length, stageEntries: exact.stageEntries
}, {
	sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
	, bytes: 16916757, cells: 1054, stageEntries: 5270
});

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const predecessorHistory = JSON.parse(await readFile(
	nativeSubtypeResultProjectionRepairHistoryPath, "utf8"));
const integrationPredecessor = predecessorHistory.integrationCommit;
for(const path of integrationPaths)
	git(["cat-file", "-e", `${integrationPredecessor}:${path}`]);

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-javascript-historical-assertion-reader-repair-"));
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
	temporaryGit(["read-tree", integrationPredecessor]);
	temporaryGit(["add", "--sparse", "--"
		, ...implementationPaths, ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", integrationPredecessor
	], { input: "Authenticate historical assertion reader repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, integrationPredecessor, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "owned-javascript-historical-assertion-reader-repair-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit, integrationPredecessor
		, integrationPredecessorHistory:
			nativeSubtypeResultProjectionRepairHistoryPath
		, discovery: {
			profile: "checked-javascript-partition-11"
			, failingTest:
				"owned JavaScript checkout repair binds both exact producer shapes"
			, historicalProducer:
				"d3c7456ee19f16a716ed09232835057ce8762148"
		}
		, rootCause: "The historical checkout-repair reader loaded workflow bytes from the authenticated d3c7456 producer but passed them to today's evolved owned-JavaScript assertion. Later timeout and step-order requirements therefore reinterpreted valid historical bytes as failures and made the checker itself the source of the regression."
		, repair: "Load and execute the exact owned-JavaScript assertion source that accompanied the historical producer, keep execution bounded in a synchronous child process, and add a negative timeout mutation proving that the historical contract still rejects malformed bytes. Preserve the exact type-surface model, runtime and support claims."
		, behavior
		, exactModel: {
			sha256: sha256(exactSources[0])
			, bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, validation: {
			focusedTests: { tests: 4, pass: 4, fail: 0 }
			, partitionInventory: {
				discoveredFailures: 1, unrelatedSubsequentFailures: 0
			}
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
