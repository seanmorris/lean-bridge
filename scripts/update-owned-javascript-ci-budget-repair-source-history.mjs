#!/usr/bin/env node
/**
 * Record the final owned-JavaScript CI budget repair.
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
	assertOwnedJavaScriptCiBudgetRepair
	, ownedJavaScriptCiBudgetRepairBehavior as behavior
	, ownedJavaScriptCiBudgetRepairHistoryAdditions as historyAdditions
	, ownedJavaScriptCiBudgetRepairHistoryPath as historyPath
	, ownedJavaScriptCiBudgetRepairImplementation as implementation
	, ownedJavaScriptCiBudgetRepairImplementationPaths as implementationPaths
	, ownedJavaScriptCiBudgetRepairIntegrationPaths as integrationPaths
	, ownedJavaScriptCiBudgetRepairPredecessor as predecessor
} from "../tests/helpers/owned-javascript-ci-budget-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const workflowPath = ".github/workflows/consumer-matrix.yml";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-owned-javascript-ci-budget-repair-source-history.mjs");
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
assert.deepEqual(assertOwnedJavaScriptCiBudgetRepair(implementationSources), {
	...behavior, livePinRefreshes: { ...behavior.livePinRefreshes }
});

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

const beforeInventory = blob(implementation, inventoryPath);
const afterInventory = await readFile(inventoryPath, "utf8");
const previous = sha256(blob(predecessor, workflowPath));
const current = sha256(blob(implementation, workflowPath));
assert.equal(beforeInventory.split(previous).length - 1
	, behavior.livePinRefreshes[workflowPath]);
assert.equal(afterInventory.split(current).length - 1
	, behavior.livePinRefreshes[workflowPath]);
assert.equal(afterInventory.includes(previous), false);
assert.equal(afterInventory.replaceAll(current, previous), beforeInventory);
const refreshed = {
	[workflowPath]: {
		count: behavior.livePinRefreshes[workflowPath], previous, current
	}
};

const directory = await mkdtemp(join(tmpdir()
	, "lean-owned-javascript-ci-budget-repair-"));
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
	], { input: "Authenticate owned JavaScript CI budget repair\n" }).trim();
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
		, milestone: "owned-javascript-ci-budget-repair-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			run: 42248057427, job: 127998154414
			, candidate: predecessor, event: "workflow_dispatch"
			, startedAt: "2026-11-06T16:03:55Z"
			, cancelledAt: "2026-11-06T17:34:08Z"
			, terminalStep: "Verify owned JavaScript engine and archive SDK contracts"
		}
		, rootCause: "The complete owned-JavaScript lane had grown to eighteen required execution steps, but its job budget remained 90 minutes. The exact final candidate completed the first sixteen steps, ran the engine/archive contract for more than seven minutes, then GitHub cancelled the job at the configured budget before that step or signed publication could finish. Rerunning the same budget would not establish complete acceptance."
		, repair: "Raise only the complete owned-JavaScript job budget to 150 minutes, matching its installed receiver lane's bounded class. Require that exact budget in the workflow contract and reject a mutation back to 90 minutes. Preserve every command, fail-closed assertion, artifact, support observation and runtime implementation."
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
			focused: { tests: 4, pass: 4, fail: 0, cancelled: 0, skipped: 0 }
			, completePinPreflight: {
				liveFiles: 2661, affectedPaths: 1, refreshedPins: 92
			}
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and 92 live `
		+ "pin refreshes.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
