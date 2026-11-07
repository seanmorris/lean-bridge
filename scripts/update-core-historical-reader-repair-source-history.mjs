#!/usr/bin/env node
/**
 * Record the complete historical-reader and dependent-Fin repair.
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
import { reconcileDependentCheckedRecordSourcePins }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	assertCoreHistoricalReaderRepair
	, coreHistoricalReaderRepairBehavior as behavior
	, coreHistoricalReaderRepairHistoryAdditions as historyAdditions
	, coreHistoricalReaderRepairHistoryPath as historyPath
	, coreHistoricalReaderRepairImplementation as implementation
	, coreHistoricalReaderRepairImplementationAdditions as implementationAdditions
	, coreHistoricalReaderRepairIntegrationPaths as integrationPaths
	, coreHistoricalReaderRepairModifiedPaths as modifiedPaths
	, coreHistoricalReaderRepairPredecessor as predecessor
} from "../tests/helpers/core-historical-reader-repair-source-history.mjs";
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
	, "Usage: update-core-historical-reader-repair-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, predecessor, implementation]), [...modifiedPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, predecessor, implementation]), [...implementationAdditions].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...integrationPaths]), [...integrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const implementationPaths = [...modifiedPaths, ...implementationAdditions];
const sources = Object.fromEntries(implementationPaths.map(path =>
	[path, blob(implementation, path)]));
assert.deepEqual(assertCoreHistoricalReaderRepair(sources), { ...behavior });

const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
const updates = [];
for(const path of modifiedPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));
const implementationAdditionRecords = implementationAdditions.map(path => {
	assert.notEqual(spawnSync("git", ["cat-file", "-e"
		, `${predecessor}:${path}`], { stdio: "ignore" }).status, 0, path);
	return { path, sha256: sha256(blob(implementation, path)) };
});

const beforeInventory = JSON.parse(blob(implementation, inventoryPath));
const afterInventory = JSON.parse(await readFile(inventoryPath, "utf8"));
const currentSourcePins = [];
const currentDigests = new Map();
for(const path of implementationPaths)
{
	const current = sha256(blob(implementation, path));
	const expected = new Set();
	let count = 0;
	for(const evidence of beforeInventory.evidence)
		for(const file of evidence.files) if(file.path === path)
		{ expected.add(file.sha256); count++; }
	if(count === 0) continue;
	assert.equal(expected.size, 1, path);
	const previous = [...expected][0];
	assert.equal(previous, sha256(blob(predecessor, path)), path);
	currentDigests.set(path, current);
	currentSourcePins.push({ path, count, previous, current });
}
const reconciled = reconcileDependentCheckedRecordSourcePins(
	beforeInventory, currentDigests);
assert.equal(currentSourcePins.length, behavior.currentSourcePaths);
assert.equal(reconciled.refreshed, behavior.refreshedPins);
assert.deepEqual(reconciled.inventory, afterInventory
	, "Only exact current-source pins may change");

const directory = await mkdtemp(join(
	tmpdir(), "lean-core-historical-reader-repair-"
));
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
	], { input: "Authenticate historical-reader and dependent-Fin repair\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of integrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, implementation, integrationCommit
			, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditionRecords = [];
	for(const path of historyAdditions)
		historyAdditionRecords.push({ path
			, sha256: sha256(await readFile(path)) });
	await writeFile(historyPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-historical-reader-repair-source-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			candidate: "d6a4044154d4e998d31b7ad24ad245d5e5b93347"
			, coreRun: 42344725453
			, coreJobs: [128325268411, 128325268447, 128325268452]
			, downstreamRun: 42344727501, downstreamJob: 128323853791
		}
		, rootCause: "Frozen evidence readers mixed producer-era archives with current checkout fixtures, validators, workflows and source bytes. Their assertions therefore moved when later legitimate source changed. Separately, generated C adapters treated dependent Fin metadata like a unary validator and imported a symbol Lean intentionally does not emit; the complete Lean wrapper already checks the live bound."
		, repair: "Load historical source maps, contracts, validators, fixtures and deferred reads from their exact producer commits; scope workflow mutations to their target jobs; keep foreign-carrier rows on their archived contract; and omit only the nonexistent unary dependent-Fin validator while preserving the complete Lean wrapper call."
		, behavior, changedSupportCells: behavior.changedSupportCells
		, runtimeSemanticChanges: behavior.runtimeSemanticChanges
		, exactModel: {
			sha256: sha256(exactSources[0]), bytes: Buffer.byteLength(exactSources[0])
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, currentSourcePins
		, inventorySha256: {
			before: sha256(blob(implementation, inventoryPath))
			, after: sha256(await readFile(inventoryPath))
		}
		, validation: {
			recursiveHistory: { tests: 1, pass: 1, fail: 0, durationSeconds: 171 }
			, structuralArchives: { tests: 8, pass: 8, fail: 0 }
			, typecheck: "passed", touchedLint: "passed"
		}
		, updates, implementationAdditions: implementationAdditionRecords
		, integrationUpdates, historyAdditions: historyAdditionRecords
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${implementationAdditionRecords.length} implementation addition, `
		+ `${integrationUpdates.length} integration transitions and `
		+ `${behavior.refreshedPins} live-pin refreshes.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
