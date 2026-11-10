#!/usr/bin/env node
/**
 * Record capacity-aware Core planning and its conservative cost refresh.
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
import {
	collectCoreContractTestPaths, coreContractShardLabels
	, coreContractShardManifest
} from "./core-contract-shards.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertVo1220CoreCapacityPlanning
	, vo1220CoreCapacityPlanningBehavior as behavior
	, vo1220CoreCapacityPlanningHistoryAdditions as historyAdditions
	, vo1220CoreCapacityPlanningHistoryPath as historyPath
	, vo1220CoreCapacityPlanningImplementation as implementation
	, vo1220CoreCapacityPlanningImplementationPaths as implementationPaths
	, vo1220CoreCapacityPlanningIntegrationPaths as integrationPaths
	, vo1220CoreCapacityPlanningPredecessor as predecessor
} from "../tests/helpers/vo1220-core-capacity-planning-source-history.mjs";

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const costPath = "scripts/core-contract-costs.json";
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
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220CoreCapacityPlanning(sources), behavior);
const priorCosts = JSON.parse(blob(predecessor, costPath));
const currentCosts = JSON.parse(sources[costPath]);
assert.deepEqual(Object.keys(currentCosts.costs), Object.keys(priorCosts.costs));
for(const [path, previous] of Object.entries(priorCosts.costs))
	assert.ok(currentCosts.costs[path].minutes >= previous.minutes, path);
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);

const paths = await collectCoreContractTestPaths();
const manifests = coreContractShardLabels.map(label =>
	coreContractShardManifest(paths, label));
const plan = manifests.map(manifest => ({
	shard: manifest.shard.index
	, files: manifest.selection.count
	, selectionSha256: manifest.selection.sha256
	, costMinutes: manifest.costs.minutes
	, concurrency: manifest.costs.concurrency
	, modeledWallMinutes: Math.ceil(
		manifest.costs.minutes / manifest.costs.concurrency * 100) / 100
	, first: manifest.selection.files[0]
}));
assert.equal(Math.max(...plan.map(item => item.modeledWallMinutes)), 159.64);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir(), "lean-core-capacity-planning-"));
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
	], { input: "Authenticate capacity-aware Core planning\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({
			path, sha256: sha256(await readFile(path))
		});
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-core-capacity-planning-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			coreRun: 42760203921
			, jobs: currentCosts.provenance.jobs
			, observedRows: 361, raisedRows: 149, newlyMeasuredRows: 32
			, retainedHighWaterRows: 177, attributedRows: 3
			, priorCriticalShard: 4, priorCriticalJob: 129651120992
			, priorCriticalDurationMs: 15700982.394272
		}
		, rootCause: "The planner assigned every shard the same raw cost even though shard 4 intentionally ran with one Node worker while the other eleven used two. It also sorted each shard alphabetically before execution, delaying dominant roots, and 786 roots still carried an unmeasured floor despite a completed twelve-shard sampler corpus."
		, repair: "Authenticate worker capacity and the serial-only root in every shard manifest, place files by cost per worker, preserve longest-first execution order, and derive runner concurrency only from the manifest. Refresh costs from all twelve exact-candidate logs as a conservative high-water union: never lower a prior measurement or the safety floor, and preserve the exact TAP-attributed split."
		, behavior, plan
		, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModelSha256: {
			before: sha256(exactSources[0]), after: sha256(exactSources[1])
		}
		, validation: {
			focusedPlanning: { tests: 5, passed: 5, failed: 0 }
			, historicalEpochs: { tests: 11, passed: 11, failed: 0 }
			, sparseAggregate: { tests: 1, passed: 1, failed: 0 }
			, syntax: "passed", eslint: "passed", diffCheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${historyAdditionRecords.length} history additions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
