#!/usr/bin/env node
/**
 * Record the producer-era Core history-budget repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertVo1220ProducerContractBudgetRepair
	, vo1220ProducerContractBudgetRepairBehavior as behavior
	, vo1220ProducerContractBudgetRepairHistoryAdditions as historyAdditions
	, vo1220ProducerContractBudgetRepairHistoryPath as historyPath
	, vo1220ProducerContractBudgetRepairImplementation as implementation
	, vo1220ProducerContractBudgetRepairImplementationPaths as implementationPaths
	, vo1220ProducerContractBudgetRepairIntegrationPaths as integrationPaths
	, vo1220ProducerContractBudgetRepairPredecessor as predecessor
} from "../tests/helpers/vo1220-producer-contract-budget-repair-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const inventoryPath = "docs/type-surface.v1.json";
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []);
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220ProducerContractBudgetRepair(sources)
	, { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const inventorySources = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
assert.equal(inventorySources[0], inventorySources[1]);
assert.equal(await readFile(inventoryPath, "utf8"), inventorySources[1]);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-producer-budget-"));
try
{
	assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
		, "--", ...integrationPaths]), [...integrationPaths].sort());
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
	], { input: "Authenticate producer-era Core budget repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-producer-contract-budget-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			coreRun: 42539104695, job: 128918184481, shard: "8/12"
			, failedTests: 1
			, failedAssertion: "hosted container history must call live readTypeSurface"
		}
		, rootCause: "Commit 8f5e50a intentionally changed hosted-container history classification to use the contracts at its immutable producer epoch, but the later Core single-pass budget continued to classify that reader with twelve live-contract readers. The stale assertion was latent because the long shard had not reached a terminal result in the preceding exact cohorts."
		, repair: "Keep the twelve current-history readers on the authenticated live type-surface pass. Treat hosted-container history as the one producer-era reader, require the shared authenticated producer-contract helper and its exact predecessor, and forbid both a live-contract read and a duplicated raw Git reader."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, currentSourcePins: []
		, inventorySha256: {
			before: sha256(inventorySources[0]), after: sha256(inventorySources[1])
		}
		, validation: {
			focusedBudgetContract: { tests: 1, pass: 1, fail: 0 }
			, completeBudgetHelper: {
				tests: 14, pass: 13, fail: 1
				, unrelatedSparseEvidenceMissing: 1
			}
			, producerHelperEquivalence: "passed"
			, focusedEslint: "passed", checkedJavaScriptTypecheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
