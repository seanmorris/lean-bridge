#!/usr/bin/env node
/**
 * Record the deferred-lane guard on the Core evidence oracle.
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
	assertDeferredLaneOracleGuard
	, deferredLaneOracleGuardBehavior as behavior
	, deferredLaneOracleGuardHistoryAdditions as historyAdditions
	, deferredLaneOracleGuardHistoryPath as historyPath
	, deferredLaneOracleGuardImplementation as implementation
	, deferredLaneOracleGuardImplementationPaths as implementationPaths
	, deferredLaneOracleGuardIntegrationPaths as integrationPaths
	, deferredLaneOracleGuardPredecessor as predecessor
} from "../tests/helpers/deferred-lane-oracle-guard-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-deferred-lane-oracle-guard-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation
	, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, git(["show", `${implementation}:${path}`])
]));
assert.deepEqual(assertDeferredLaneOracleGuard(sources), { ...behavior });
const inventories = [predecessor, implementation].map(commit =>
	sha256(git(["show", `${commit}:${inventoryPath}`])));
assert.equal(inventories[0], inventories[1]);
assert.equal(sha256(await readFile(inventoryPath)), inventories[0]);
const exactSources = [predecessor, implementation].map(commit =>
	git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir()
	, "lean-deferred-lane-oracle-guard-history-"));
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
	], { input: "Authenticate deferred-lane oracle guard\n" }).trim();
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
		, milestone: "deferred-lane-oracle-guard-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, supersedes: {
			regexGuard: "50a36dde0a7486c60e84b86a4f70600ef739f998"
			, astGuard: "238c02004036390d1daf9b1e093acbcdf95e012a"
			, reason: "Both guards matched four hand-written reader shapes that miss trailing-slash bases, bare exported archive roots, template roots, two-line constants and in-test declarations, skipped every non-test helper, counted loaders without binding them, and their mutations tripped on loader absence rather than reader detection."
		}
		, rootCause: "The sparse-lane guards decided which modules open retained evidence with ad-hoc regular expressions instead of the oracle the Core planner already uses, so a lane could pass with an eager reader the shapes did not recognize. The Fin 0 CI integration's disable/enable equivalence had been removed from its current suite because it is digest-gated against the live workflow; it holds only at the recorded milestone."
		, repair: "Decide retained references for the Node and native lanes with coreContractEvidenceDirectoryReferences over every non-source-history module of each static closure, bind the few reference-only helpers by module and family and refuse any module-level read in them, bind all 98 native loaders and 8 Node loaders by identity and order, keep the eager, dropped, renamed, exact-binding and named-current-module mutations, and restore the Fin 0 CI disable/enable equivalence at its milestone inside the deferred history suite. No workflow, evidence archive, support cell, pin or product source changes."
		, behavior
		, validation: {
			measured: {
				"tests/retained-contract-tests.test.mjs": {
					tests: 6, pass: 6, fail: 0
					, nodeLaneMilliseconds: 13823, nativeLaneMilliseconds: 4727
				}
				, "tests/helpers/fin-record-zero-ci-history-tests.mjs": {
					tests: 6, pass: 5
					, environmental: "one type-surface authentication test needs docs/evidence/browser-callback-fin-20261008, absent from the sparse review worktree"
				}
			}
			, reportedByCodex: {
				base: predecessor
				, sparseSevenEntryWall: { tests: 189, pass: 153, skip: 36, fail: 0, seconds: 38.2 }
				, note: "Reported on the coordination board for 1fa9c39 before this guard; not re-measured here."
			}
		}
		, exactModel: {
			sha256: sha256(exactSources[0])
			, bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, inventorySha256: inventories[0]
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
