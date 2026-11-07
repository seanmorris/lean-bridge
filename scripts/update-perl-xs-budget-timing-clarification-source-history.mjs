#!/usr/bin/env node
/**
 * Record the evidence-precise complete-Perl budget explanation.
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
	assertPerlXsBudgetTimingClarification
	, perlXsBudgetTimingClarificationBehavior as behavior
	, perlXsBudgetTimingClarificationHistoryAdditions as historyAdditions
	, perlXsBudgetTimingClarificationHistoryPath as historyPath
	, perlXsBudgetTimingClarificationImplementation as implementation
	, perlXsBudgetTimingClarificationImplementationPaths as implementationPaths
	, perlXsBudgetTimingClarificationIntegrationPaths as integrationPaths
	, perlXsBudgetTimingClarificationPredecessor as predecessor
} from "../tests/helpers/perl-xs-budget-timing-clarification-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-perl-xs-budget-timing-clarification-source-history.mjs");
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

const workflow = blob(implementation, implementationPaths[0]);
assert.deepEqual(assertPerlXsBudgetTimingClarification(workflow)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
const updates = [await gitSourceHistoryTransition(
	implementationPaths[0], predecessor, implementation
	, { maximumEditBytes: 64 * 1024 * 1024 })];

const beforeInventory = blob(implementation, inventoryPath);
const afterInventory = await readFile(inventoryPath, "utf8");
const previous = sha256(blob(predecessor, implementationPaths[0]));
const current = sha256(workflow);
assert.equal(previous
	, "3b4727d0f18f5642ec457ba4765627bb8ab258e2e5d7b6649b4d32080134dbaa");
assert.equal(current
	, "bf209445a99582425f5df222dc202a967ffc0452ddbfa3e4c3156e3b3041b048");
const count = behavior.refreshedPins;
assert.equal(beforeInventory.split(previous).length - 1, count);
assert.equal(afterInventory.split(current).length - 1, count);
assert.equal(afterInventory.split(previous).length - 1, 0);
assert.equal(afterInventory.replaceAll(current, previous), beforeInventory);

const directory = await mkdtemp(join(tmpdir(), "lean-perl-budget-timing-"));
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
	], { input: "Authenticate Perl XS budget timing clarification\n" }).trim();
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
		, milestone: "perl-xs-budget-timing-clarification-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			run: 42344727501, job: 128323854103
			, candidate: "d6a4044154d4e998d31b7ad24ad245d5e5b93347"
			, jobStartedAt: "2026-11-07T06:27:26Z"
			, compareStartedAt: "2026-11-07T06:45:46Z"
			, compareCompletedAt: "2026-11-07T08:29:04Z"
			, finalVerificationStartedAt: "2026-11-07T08:29:04Z"
			, finalVerificationCancelledAt: "2026-11-07T09:27:38Z"
			, jobCancelledAt: "2026-11-07T09:27:45Z"
		}
		, rootCause: "The first budget repair described 122 minutes as Compare/Verify work. The hosted timestamps show 18 minutes 20 seconds of setup, 103 minutes 18 seconds in Compare, and final verification beginning 121 minutes 38 seconds after job start. The timeout diagnosis and 240-minute repair were correct, but the explanatory label was imprecise."
		, repair: "State the measured boundary precisely as 122 minutes after job start. Keep the 240-minute budget, commands, steps, matrix, artifacts, support observations and runtime semantics unchanged."
		, behavior
		, exactModel: {
			sha256: sha256(exactSources[0])
			, bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, refreshed: {
			path: implementationPaths[0], count, previous, current
		}
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, validation: {
			focused: { tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0 }
			, completePinPreflight: {
				liveFiles: 2661, affectedPaths: 1, refreshedPins: count
			}
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and ${count} `
		+ "live pin refreshes.\n");
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
