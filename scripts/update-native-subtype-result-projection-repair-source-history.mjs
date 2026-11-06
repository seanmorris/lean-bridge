#!/usr/bin/env node
/**
 * Record the native Subtype result-projection fixture repair.
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
	assertNativeSubtypeResultProjectionRepair
	, nativeSubtypeResultProjectionRepairBehavior as behavior
	, nativeSubtypeResultProjectionRepairHistoryAdditions as historyAdditions
	, nativeSubtypeResultProjectionRepairHistoryPath as historyPath
	, nativeSubtypeResultProjectionRepairImplementation as implementation
	, nativeSubtypeResultProjectionRepairImplementationPaths as implementationPaths
	, nativeSubtypeResultProjectionRepairIntegrationPaths as integrationPaths
	, nativeSubtypeResultProjectionRepairPredecessor as predecessor
} from "../tests/helpers/native-subtype-result-projection-repair-source-history.mjs";
import {
	ownedJavaScriptCiBudgetRepairHistoryPath
} from "../tests/helpers/owned-javascript-ci-budget-repair-source-history.mjs";
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
	, "Usage: update-native-subtype-result-projection-repair-source-history.mjs");
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
const asserted = assertNativeSubtypeResultProjectionRepair(
	implementationSources);
assert.deepEqual(asserted, {
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

const predecessorHistory = JSON.parse(await readFile(
	ownedJavaScriptCiBudgetRepairHistoryPath, "utf8"));
const integrationPredecessor = predecessorHistory.integrationCommit;
for(const path of integrationPaths)
	git(["cat-file", "-e", `${integrationPredecessor}:${path}`]);
const beforeInventory = blob(integrationPredecessor, inventoryPath);
const afterInventory = await readFile(inventoryPath, "utf8");
const refreshed = {};
let reconstructed = afterInventory;
for(const path of implementationPaths)
{
	const previous = sha256(blob(predecessor, path));
	const current = sha256(blob(implementation, path));
	const count = behavior.livePinRefreshes[path];
	assert.equal(beforeInventory.split(previous).length - 1, count, path);
	assert.equal(afterInventory.split(current).length - 1, count, path);
	assert.equal(afterInventory.includes(previous), false, path);
	reconstructed = reconstructed.replaceAll(current, previous);
	refreshed[path] = { count, previous, current };
}
assert.equal(reconstructed, beforeInventory);

const directory = await mkdtemp(join(tmpdir()
	, "lean-native-subtype-result-projection-repair-"));
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
	], { input: "Authenticate native Subtype result projection repair\n" }).trim();
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
		, milestone: "native-subtype-result-projection-repair-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit, integrationPredecessor
		, integrationPredecessorHistory: ownedJavaScriptCiBudgetRepairHistoryPath
		, discovery: {
			run: 42248057427, job: 128006559588
			, candidate: "c2eca28ce3957c14e66364767bac90656ec5074e"
			, event: "workflow_dispatch"
			, profile: "Perl / Perl XS (5.36.3-threaded)"
			, failingTest: "relocated source-free native packages run author-checked constructors at every refined site"
		}
		, rootCause: "The current native installed-package fixture still selected checked input constructors for three Lean-produced Subtype results. Directional Subtype semantics correctly require those results to project their already-proved base values with constructor:null, so the validator rejected the stale fixture before packaging. The test appended empty error.details as `: {}`, which initially obscured the rejected direction."
		, repair: "Make shout, pad and join results constructor-free projections in the live native fixture and assert that direction explicitly. Preserve the archived PHP-Wasm producer's older constructor selections in its own historical fixture instead of inheriting them from the live native contract. Keep runtime implementation, support cells and the exact model unchanged."
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
			focusedC: { tests: 3, pass: 3, fail: 0, durationMs: 244878.464685 }
			, phpWasmFixture: { tests: 8, pass: 2, fail: 0, skipped: 6 }
			, localPerlBoundary: "Model construction passes; glibc 2.36 host cannot install packages requiring glibc 2.38"
			, completePinPreflight: {
				liveFiles: 2661, affectedPaths: 3, refreshedPins: 38
			}
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and 38 live `
		+ "pin refreshes.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
