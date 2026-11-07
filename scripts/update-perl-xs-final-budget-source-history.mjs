#!/usr/bin/env node
/**
 * Record the final complete-Perl consumer job budget repair.
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
	assertPerlXsFinalBudget
	, perlXsFinalBudgetBehavior as behavior
	, perlXsFinalBudgetHistoryAdditions as historyAdditions
	, perlXsFinalBudgetHistoryPath as historyPath
	, perlXsFinalBudgetImplementation as implementation
	, perlXsFinalBudgetImplementationPaths as implementationPaths
	, perlXsFinalBudgetIntegrationPaths as integrationPaths
	, perlXsFinalBudgetPredecessor as predecessor
} from "../tests/helpers/perl-xs-final-budget-source-history.mjs";
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
	, "Usage: update-perl-xs-final-budget-source-history.mjs");
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
assert.deepEqual(assertPerlXsFinalBudget(implementationSources), {
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
const refreshed = {};
for(const path of implementationPaths)
{
	const previous = sha256(blob(predecessor, path));
	const current = sha256(blob(implementation, path));
	const count = behavior.livePinRefreshes[path];
	assert.equal(beforeInventory.split(previous).length - 1, count, path);
	assert.equal(afterInventory.split(current).length - 1, count, path);
	assert.equal(afterInventory.split(previous).length - 1, 0, path);
	refreshed[path] = { count, previous, current };
}
let reconstructed = afterInventory;
for(const item of Object.values(refreshed))
	reconstructed = reconstructed.replaceAll(item.current, item.previous);
assert.equal(reconstructed, beforeInventory);

const directory = await mkdtemp(join(tmpdir(), "lean-perl-xs-final-budget-"));
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
	], { input: "Authenticate final Perl XS job budget\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const additions = [];
	for(const path of historyAdditions)
		additions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1, milestone: "perl-xs-final-budget-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			run: 42344727501, job: 128323854103
			, candidate: predecessor, event: "workflow_dispatch"
			, startedAt: "2026-11-07T06:27:26Z"
			, cancelledAt: "2026-11-07T09:27:45Z"
			, terminalStep: "Verify owned Perl values and installed CPAN archives"
		}
		, rootCause: "The complete threaded Perl 5.36.3 lane passed the repaired corpus comparison and entered final owned-value/archive verification, but the reusable workflow still capped the entire job at 180 minutes. GitHub cancelled it at exactly that boundary. The earlier 180-minute repair measured only the then-current installed Compare/Verify chain and no longer bounded the expanded complete lane."
		, repair: "Raise only the four complete Perl XS matrix jobs to 240 minutes, matching the established long installed-package budget class. Keep every command, assertion, artifact and support observation unchanged. Require the exact budget in both live workflow readers and refresh only their forty live source pins."
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
			focused: { tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0 }
			, completePinPreflight: {
				liveFiles: 2661, affectedPaths: 3, refreshedPins: 40
			}
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and 40 live `
		+ "pin refreshes.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
