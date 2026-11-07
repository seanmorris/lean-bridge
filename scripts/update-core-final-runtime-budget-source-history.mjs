#!/usr/bin/env node
/**
 * Record the final complete-Core shard runtime budget repair.
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
	assertCoreFinalRuntimeBudget
	, coreFinalRuntimeBudgetBehavior as behavior
	, coreFinalRuntimeBudgetHistoryAdditions as historyAdditions
	, coreFinalRuntimeBudgetHistoryPath as historyPath
	, coreFinalRuntimeBudgetImplementation as implementation
	, coreFinalRuntimeBudgetImplementationPaths as implementationPaths
	, coreFinalRuntimeBudgetIntegrationPaths as integrationPaths
	, coreFinalRuntimeBudgetPredecessor as predecessor
} from "../tests/helpers/core-final-runtime-budget-source-history.mjs";
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
	, "Usage: update-core-final-runtime-budget-source-history.mjs");
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
assert.deepEqual(assertCoreFinalRuntimeBudget(implementationSources), {
	...behavior, livePinRefreshes: { ...behavior.livePinRefreshes }
});

const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const beforeInventory = blob(implementation, inventoryPath);
const afterInventory = await readFile(inventoryPath, "utf8");
const path = ".github/workflows/quality.yml";
const previous = sha256(blob(predecessor, path));
const current = sha256(blob(implementation, path));
const count = behavior.livePinRefreshes[path];
assert.equal(beforeInventory.split(previous).length - 1, count);
assert.equal(afterInventory.split(current).length - 1, count);
assert.equal(afterInventory.split(previous).length - 1, 0);
assert.equal(afterInventory.replaceAll(current, previous), beforeInventory);
const refreshed = { path, count, previous, current };

const directory = await mkdtemp(join(tmpdir(), "lean-core-final-runtime-budget-"));
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
	], { input: "Authenticate final Core shard runtime budget\n" }).trim();
	const integrationUpdates = [];
	for(const integrationPath of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(integrationPath
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const additionPath of historyAdditions)
		additions.push({ path: additionPath
			, sha256: sha256(await readFile(additionPath)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1, milestone: "core-final-runtime-budget-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			run: 42344725453, job: 128325268374
			, candidate: predecessor
			, jobStartedAt: "2026-11-07T06:31:39Z"
			, contractStartedAt: "2026-11-07T06:38:54Z"
			, contractCancelledAt: "2026-11-07T10:31:52Z"
			, jobCancelledAt: "2026-11-07T10:31:55Z"
			, terminalTestCount: 414
		}
		, rootCause: "The complete Core shard 6 passed 414 contract checks and was still advancing through the authenticated history replay when GitHub cancelled the whole job at the exact 240-minute budget. The shard had already passed checkout and evidence materialization; the measured history-heavy component-array process remained live with bounded memory. Earlier candidates were superseded before this boundary was observed, so their cancellations never qualified the complete shard runtime."
		, repair: "Raise only the twelve complete Core contract-shard jobs from 240 to 360 minutes. Preserve the exact test selection, twelve disjoint manifests, six-job concurrency, commands, assertions, artifacts, source-history checks, runtime behavior and support observations. Refresh only the workflow's one live source citation."
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
			focusedAssertion: { tests: 1, pass: 1, fail: 0 }
			, hostedDiscovery: {
				completedTests: 414, processMemoryBoundMiB: 4096
			}
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and one live `
		+ "workflow pin refresh.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
