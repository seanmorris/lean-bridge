#!/usr/bin/env node
/**
 * Record the complete deferred-workflow history isolation repair.
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
	assertDeferredWorkflowHistoryIsolation
	, deferredWorkflowHistoryIsolationBehavior as behavior
	, deferredWorkflowHistoryIsolationHistoryAdditions as historyAdditions
	, deferredWorkflowHistoryIsolationHistoryPath as historyPath
	, deferredWorkflowHistoryIsolationImplementation as implementation
	, deferredWorkflowHistoryIsolationImplementationPaths as implementationPaths
	, deferredWorkflowHistoryIsolationIntegrationPaths as integrationPaths
	, deferredWorkflowHistoryIsolationPredecessor as predecessor
} from "../tests/helpers/deferred-workflow-history-isolation-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-deferred-workflow-history-isolation-source-history.mjs");
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
assert.deepEqual(assertDeferredWorkflowHistoryIsolation(implementationSources)
	, { ...behavior, livePinRefreshes: { ...behavior.livePinRefreshes } });

const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
assert.deepEqual(
	{
		sha256: sha256(exactSources[0])
		, bytes: Buffer.byteLength(exactSources[0])
		, cells: exact.model.length, stageEntries: exact.stageEntries
	}
	, {
		sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
		, bytes: 16916757, cells: 1054, stageEntries: 5270
	}
);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const beforeInventory = blob(implementation, inventoryPath);
const afterInventory = await readFile(inventoryPath, "utf8");
let restoredInventory = afterInventory;
const refreshed = {};
for(const [path, count] of Object.entries(behavior.livePinRefreshes))
{
	const previous = sha256(blob(predecessor, path));
	const current = sha256(blob(implementation, path));
	assert.equal(beforeInventory.split(previous).length - 1, count, path);
	assert.equal(afterInventory.split(current).length - 1, count, path);
	assert.equal(afterInventory.includes(previous), false, path);
	restoredInventory = restoredInventory.replaceAll(current, previous);
	refreshed[path] = { count, previous, current };
}
assert.equal(restoredInventory, beforeInventory);

const directory = await mkdtemp(join(tmpdir()
	, "lean-deferred-workflow-history-isolation-"));
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
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate deferred-workflow history isolation\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "deferred-workflow-history-isolation-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			run: 42214825457
			, jobs: [
				{ job: 127890569531, lane: "Perl / Perl XS (5.36.3-threaded)" }
				, { job: 127890569578, lane: "Perl / Perl XS (5.38.2-threaded)" }
			]
			, failures: [
				"Fin product arrays changes current source pins without inventing installed evidence"
				, "C adapters compare every element's component and active error branch on caller limbs before Lean runs"
			]
		}
		, rootCause: "The deferred consumer jobs still reached 25 exact-history suites and three retained archive readers through top-level imports. The guard excluded source-history modules from its evidence oracle and modeled only four hand-curated parent entrypoints, so the sparse lane could pass its guard and then execute contracts whose immutable corpus was intentionally absent. The generated C assertion separately named pre-prefix locals after the generator had moved to _lb_checked and _lb_budget."
		, repair: "Register all 28 retained suites through the required-by-default and consumer-deferred loader, audit every test entry from all six deferred workflow jobs, refuse both eager exact-history modules and unbound retained evidence references, bind all 126 native loaders, and update the C assertion to the current generated identifiers without weakening its ordering check."
		, behavior
		, exactModel: {
			sha256: sha256(exactSources[0])
			, bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, inventorySha256: {
			before: sha256(beforeInventory), after: sha256(afterInventory)
		}
		, refreshed, changedSupportCells: 0, runtimeSemanticChanges: 0
		, validation: {
			retainedGuard: { tests: 7, pass: 7, fail: 0, milliseconds: 23300 }
			, failingEntrypoint: { tests: 11, pass: 8, skip: 3, fail: 0
				, milliseconds: 918 }
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${Object.values(refreshed).reduce((sum, item) => sum + item.count, 0)}`
		+ " live pin refreshes.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
