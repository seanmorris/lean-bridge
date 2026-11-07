#!/usr/bin/env node
/**
 * Record the successor package-closure and historical-timeout repair.
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
	dependentCheckedRecordPromotionCurrentSourcePaths
	, reconcileDependentCheckedRecordSourcePins
} from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertVo1220SuccessorContractRepair
	, vo1220SuccessorContractRepairBehavior as behavior
	, vo1220SuccessorContractRepairHistoryAdditions as historyAdditions
	, vo1220SuccessorContractRepairHistoryPath as historyPath
	, vo1220SuccessorContractRepairImplementation as implementation
	, vo1220SuccessorContractRepairImplementationPaths as implementationPaths
	, vo1220SuccessorContractRepairIntegrationPaths as integrationPaths
	, vo1220SuccessorContractRepairPredecessor as predecessor
} from "../tests/helpers/vo1220-successor-contract-repair-source-history.mjs";

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
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=ADRCT"
	, predecessor, implementation]), []);
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());

const sources = Object.fromEntries(implementationPaths.map(path => [
	path, blob(implementation, path)
]));
assert.deepEqual(assertVo1220SuccessorContractRepair(sources), { ...behavior });
const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(exactSources[0], exactSources[1]);
const exact = JSON.parse(exactSources[0]);

const beforeInventorySource = blob(implementation, inventoryPath);
const beforeInventory = JSON.parse(beforeInventorySource);
assert.equal(await readFile(inventoryPath, "utf8"), beforeInventorySource);
const currentSourcePaths = dependentCheckedRecordPromotionCurrentSourcePaths(
	beforeInventory, implementationPaths
);
const currentDigests = new Map(currentSourcePaths.map(path => [
	path, sha256(blob(implementation, path))
]));
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

const directory = await mkdtemp(join(tmpdir(), "lean-successor-contract-"));
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
	], { input: "Authenticate successor contract repair and live pins\n" }).trim();
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
		, milestone: "vo1220-successor-contract-repair-source-v1"
		, predecessorCommit: predecessor
		, implementationCommit: implementation
		, implementationCommits: [implementation]
		, integrationCommit
		, discovery: {
			coreRun: 42421648293, downstreamRun: 42423177647
			, terminalFailuresAtRepair: 9
			, sharedPackageClosureFailures: 8
			, historicalModelFailures: 1
		}
		, rootCause: "The dependent-Fin helper entered six shipped adapter graphs without entering the explicit CLI, Nix and checked-JavaScript registries. Separately, a live timeout expectation was reused while validating an authentic older workflow snapshot."
		, repair: "Close every applicable source/package registry, scan the entire shipped CLI relative import graph, and pass exact historical timeout expectations without weakening live defaults."
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
			cliArchiveInstall: "passed", cliModuleClosure: "passed"
			, componentEngineClosure: "passed before history rewind"
			, checkedJavaScriptInventory: "passed"
			, historicalDocumentation: "passed"
			, liveWorkflowMutationsRejected: 65
			, lint: "passed", typecheck: "passed"
		}
		, updates, integrationUpdates
		, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation transitions, `
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
