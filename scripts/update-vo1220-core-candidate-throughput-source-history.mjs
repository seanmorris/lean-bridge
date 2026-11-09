#!/usr/bin/env node
/**
 * Record the Core candidate throughput repair for VO #1220.
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
	collectCoreContractTestPaths, coreContractCosts
	, coreContractCostManifest, coreContractShardLabels
	, coreContractShardManifest
} from "./core-contract-shards.mjs";
import {
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	vo1220CoreCandidateThroughputCommits as commits
	, vo1220CoreCandidateThroughputHistoryAdditions as historyAdditions
	, vo1220CoreCandidateThroughputHistoryPath as historyPath
	, vo1220CoreCandidateThroughputImplementation as implementation
	, vo1220CoreCandidateThroughputImplementationAdditions as implementationAdditions
	, vo1220CoreCandidateThroughputImplementationPaths as implementationPaths
	, vo1220CoreCandidateThroughputIntegrationPaths as integrationPaths
	, vo1220CoreCandidateThroughputPredecessor as predecessor
} from "../tests/helpers/vo1220-core-candidate-throughput-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-vo1220-core-candidate-throughput-source-history.mjs");
assert.equal(existsSync(historyPath), false, `${historyPath} already exists`);
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.deepEqual(git(["rev-list", "--reverse", "--first-parent"
	, `${predecessor}..${implementation}`]).trim().split("\n"), commits);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), [...implementationAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...integrationPaths]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const beforeInventory = JSON.parse(blob(predecessor, inventoryPath));
const afterInventory = JSON.parse(blob(implementation, inventoryPath));
const currentSourcePaths = [
	".github/workflows/quality.yml"
	, "src/adoption/test-profiles.mjs"
	, "tests/fin-scalar-dispatch-inventory.test.mjs"
	, "tests/helpers/fin-scalar-dispatch-inventory.mjs"
	, "tests/helpers/hosted-container-inventory.mjs"
	, "tests/helpers/perl-scalar-promotion.mjs"
	, "tests/perl-relocated-promotion.test.mjs"
];
assert.deepEqual(dependentCheckedRecordPromotionCurrentSourcePaths(
	beforeInventory, currentSourcePaths), currentSourcePaths);
const currentDigests = new Map(currentSourcePaths.map(path => [
	path, sha256(blob(implementation, path))
]));
const pinTransitions = currentSourcePaths.map(path => {
	const before = beforeInventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path);
	const after = afterInventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path);
	assert.equal(before.length, after.length, path);
	assert.equal(new Set(before.map(file => file.sha256)).size, 1, path);
	assert.deepEqual(new Set(after.map(file => file.sha256))
		, new Set([currentDigests.get(path)]), path);
	return {
		path, count: after.length, previousSha256: before[0].sha256
		, currentSha256: currentDigests.get(path)
	};
});
const reconciled = reconcileDependentCheckedRecordSourcePins(
	beforeInventory, currentDigests);
assert.equal(reconciled.refreshed, 133);
assert.deepEqual(reconciled.inventory, afterInventory);
assert.deepEqual(pinTransitions.map(item => item.count)
	, [1, 98, 12, 12, 4, 2, 4]);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactModels[0], exactModels[1]);
const exactModel = JSON.parse(exactModels[0]);

const paths = await collectCoreContractTestPaths();
const costs = coreContractCosts(paths);
const manifests = coreContractShardLabels.map(label =>
	coreContractShardManifest(paths, label));
const loads = manifests.map(manifest => manifest.costs.minutes);
const provenance = coreContractCostManifest.provenance;
assert.equal(paths.length, 1123);
assert.equal(manifests.length, 12);
assert.ok(Math.max(...loads) - Math.min(...loads) < 0.02);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 256 * 1024 * 1024 }));
const additions = implementationAdditions.map(path => ({
	path, sha256: sha256(blob(implementation, path))
}));

const directory = await mkdtemp(join(tmpdir(), "lean-vo1220-core-throughput-"));
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
	], { input: "Authenticate Core candidate throughput repair\n" }).trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const recordedHistoryAdditions = [];
	for(const path of historyAdditions)
		recordedHistoryAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "vo1220-core-candidate-throughput-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, implementationCommits: commits
		, scope: "Replace repeated whole-history scans with exact authenticated revision reads, balance the closed Core contract by observed root cost, split one side-effect umbrella into four independently schedulable roots, run all twelve balanced shards concurrently, and refresh every affected live source citation. Preserve runtime and package semantics, all 1,054 support cells, all 5,270 stage entries, immutable archives and every prior source-history milestone."
		, updates, implementationAdditions: additions
		, integrationUpdates, historyAdditions: recordedHistoryAdditions
		, pinTransitions
		, exactModel: {
			sha256: sha256(exactModels[0]), bytes: Buffer.byteLength(exactModels[0])
			, cells: exactModel.model.length, stageEntries: exactModel.stageEntries
		}
		, costModel: {
			kind: coreContractCostManifest.kind
			, partition: coreContractCostManifest.partition
			, roots: paths.length, shards: manifests.length
			, measuredRoots: Object.values(coreContractCostManifest.costs)
				.filter(item => item.measured).length
			, floorRoots: Object.values(coreContractCostManifest.costs)
				.filter(item => !item.measured).length
			, minimumLoadMinutes: Math.min(...loads)
			, maximumLoadMinutes: Math.max(...loads)
			, provenance
		}
		, measurements: {
			componentArrayHistoryPartition03: {
				recordedCostMinutes: costs.get(
					"tests/component-array-history-partition-03.test.mjs") / 100
				, optimizedDurationMs: 1129342.603212
				, tests: 159, passed: 159, failed: 0
			}
			, hostedWallModel: {
				beforeMinutes: 357, afterMinutes: 140
				, savedMinutes: 217, savedPercent: 60.78431372549019
			}
		}
		, behavior: {
			modifiedFiles: implementationPaths.length
			, addedFiles: implementationAdditions.length
			, splitRoots: 4, priorRoots: 1120, currentRoots: 1123
			, refreshedPins: 133, changedSupportCells: 0
			, runtimeSemanticChanges: 0, maxParallel: 12
		}
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
		+ `${additions.length} additions, ${integrationUpdates.length} `
		+ `registrations and 133 refreshed pins.\n`);
}
finally
{ await rm(directory, { recursive: true, force: true }); }
