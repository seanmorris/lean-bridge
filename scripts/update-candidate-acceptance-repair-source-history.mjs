#!/usr/bin/env node
/**
 * Record the complete candidate repair, exact pin refresh and hub integration.
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
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	assertCandidateAcceptanceRepair
	, candidateAcceptanceRepairBehavior as behavior
	, candidateAcceptanceRepairHistoryAdditions as historyAdditions
	, candidateAcceptanceRepairHistoryPath as historyPath
	, candidateAcceptanceRepairImplementation as implementation
	, candidateAcceptanceRepairImplementationPaths as implementationPaths
	, candidateAcceptanceRepairIntegrationPaths as integrationPaths
	, candidateAcceptanceRepairPredecessor as predecessor
} from "../tests/helpers/candidate-acceptance-repair-source-history.mjs";
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
	, "Usage: update-candidate-acceptance-repair-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation])
	, [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const sources = Object.fromEntries(implementationPaths.map(path =>
	[path, blob(implementation, path)]));
assert.deepEqual(assertCandidateAcceptanceRepair(sources), { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);

const beforeInventorySource = blob(implementation, inventoryPath);
const beforeInventory = JSON.parse(beforeInventorySource);
assert.equal(await readFile(inventoryPath, "utf8"), beforeInventorySource
	, "Inventory must still equal the implementation commit before sealing");
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	beforeInventory, implementationPaths
);
const currentDigests = new Map(currentSourcePaths.map(path =>
	[path, sha256(blob(implementation, path))]));
const currentSourcePins = [];
for(const path of currentSourcePaths)
{
	const pins = beforeInventory.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path);
	const previous = new Set(pins.map(file => file.sha256));
	assert.equal(previous.size, 1, path);
	assert.equal([...previous][0], sha256(blob(predecessor, path)), path);
	currentSourcePins.push({
		path, count: pins.length, previous: [...previous][0]
		, current: currentDigests.get(path)
	});
}
const reconciled = reconcileDependentCheckedRecordSourcePins(
	beforeInventory, currentDigests
);
assert.equal(currentSourcePins.length, behavior.currentSourcePaths);
assert.equal(reconciled.refreshed, behavior.refreshedPins);
const afterInventorySource = JSON.stringify(reconciled.inventory, null, 2) + "\n";

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-candidate-acceptance-repair-"
));
let inventoryWritten = false;
try
{
	await writeFile(inventoryPath, afterInventorySource);
	inventoryWritten = true;
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
	], { input: "Authenticate final candidate repair and exact live pins\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({ path, sha256: sha256(await readFile(path)) });
	const implementationCommits = git(["rev-list", "--reverse"
		, `${predecessor}..${implementation}`]).trim().split("\n");
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "candidate-acceptance-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, implementationCommits, integrationCommit
		, discovery: {
			candidate: "d6a4044154d4e998d31b7ad24ad245d5e5b93347"
			, coreRun: 42344725453, downstreamRun: 42344727501
			, rubyJob: 128323854052, jvmJob: 128323854228
		}
		, rootCause: "The first complete exact cohort exposed a finite set of producer-era/current-source reader mismatches, unsafe direct assertions over unowned inventory paths, dependent-Fin copied-adapter imports that Lean does not emit, copied JVM fixture refusals hidden by reflection, and WIT/managed jobs whose late qualifications could not fit their budgets."
		, repair: "Bind historical readers and renderers to their recorded producers, close the complete unowned-path sets, preserve dependent Fin in the complete Lean wrapper without a nonexistent unary import, surface copied-record constructor refusals, and preserve every late qualification through parallel WIT finalization or a measured managed ceiling. Refresh only exact current-source pins after all behavior and CI repairs are stable."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModel: {
			sha256: sha256(exactSources[0]), bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, currentSourcePins
		, inventorySha256: {
			before: sha256(beforeInventorySource), after: sha256(afterInventorySource)
		}
		, validation: {
			jvmVariants: { tests: 1, pass: 1, fail: 0, durationSeconds: 796 }
			, jvmCollections: { tests: 1, pass: 1, fail: 0, durationSeconds: 675 }
			, managedHistory: { tests: 13, pass: 13, fail: 0, durationSeconds: 623 }
			, workflowLint: "passed", typecheck: "passed", touchedLint: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${reconciled.refreshed} exact live-pin refreshes.\n`);
}
catch(error)
{
	if(inventoryWritten) await writeFile(inventoryPath, beforeInventorySource);
	throw error;
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
