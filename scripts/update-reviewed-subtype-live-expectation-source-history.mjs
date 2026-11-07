#!/usr/bin/env node
/**
 * Record the reviewed-Subtype live/archive expectation split.
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
import { reconcileDependentCheckedRecordSourcePins } from "../tests/helpers/dependent-checked-record-promotion.mjs";
import {
	assertReviewedSubtypeLiveExpectationRepair
	, reviewedSubtypeLiveExpectationBehavior as behavior
	, reviewedSubtypeLiveExpectationHistoryAdditions as historyAdditions
	, reviewedSubtypeLiveExpectationHistoryPath as historyPath
	, reviewedSubtypeLiveExpectationImplementation as implementation
	, reviewedSubtypeLiveExpectationImplementationPaths as implementationPaths
	, reviewedSubtypeLiveExpectationIntegrationPaths as integrationPaths
	, reviewedSubtypeLiveExpectationPredecessor as predecessor
} from "../tests/helpers/reviewed-subtype-live-expectation-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const inventoryPath = "docs/type-surface.v1.json";
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const integrationSources = integrationPaths.filter(path => path !== inventoryPath);
const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
const blob = (commit, path) => git(["show", `${commit}:${path}`]);

assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-reviewed-subtype-live-expectation-source-history.mjs");
assert.equal(existsSync(historyPath), false, "History already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim(), implementation);
assert.equal(git(["rev-parse", "HEAD^"]).trim(), predecessor);
assert.deepEqual(names(["diff", "--name-only", predecessor, implementation
	, "--"]), [...implementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationSources].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historyAdditions]), [...historyAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${implementation}:${historyPath}`], { stdio: "ignore" }).status, 0);

const implementationSources = Object.fromEntries(implementationPaths.map(
	path => [path, blob(implementation, path)]));
assert.deepEqual(assertReviewedSubtypeLiveExpectationRepair(
	implementationSources), { ...behavior });

const exactSources = [predecessor, implementation].map(commit =>
	blob(commit, exactModelPath));
assert.equal(new Set(exactSources.map(source => sha256(source))).size, 1);
const exact = JSON.parse(exactSources[0]);
const exactModel = { sha256: sha256(exactSources[0])
	, bytes: Buffer.byteLength(exactSources[0])
	, cells: exact.model.length, stageEntries: exact.stageEntries };
assert.deepEqual(exactModel, {
	sha256: "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f"
	, bytes: 16916757, cells: 1054, stageEntries: 5270
});

const inventories = [predecessor, implementation].map(commit =>
	blob(commit, inventoryPath));
assert.equal(sha256(inventories[0]), sha256(inventories[1]));
const liveDigests = new Map(implementationPaths.map(path =>
	[path, sha256(blob(implementation, path))]));
for(const path of integrationSources)
	liveDigests.set(path, sha256(await readFile(path)));
const pinned = reconcileDependentCheckedRecordSourcePins(
	JSON.parse(inventories[1]), liveDigests);
assert.ok(pinned.refreshed > 0);
await writeFile(inventoryPath
	, JSON.stringify(pinned.inventory, null, 2) + "\n");
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"]), [...integrationPaths].sort());

const originalInventory = JSON.parse(inventories[1]);
const refreshed = {};
assert.equal(pinned.inventory.observations.length
	, originalInventory.observations.length);
assert.deepEqual(pinned.inventory.observations, originalInventory.observations);
assert.equal(pinned.inventory.evidence.length, originalInventory.evidence.length);
for(const [index, evidence] of pinned.inventory.evidence.entries())
	for(const [position, file] of evidence.files.entries())
	{
		const previous = originalInventory.evidence[index].files[position];
		assert.equal(file.path, previous.path);
		if(file.sha256 === previous.sha256) continue;
		assert.equal(file.sha256, liveDigests.get(file.path), file.path);
		const item = refreshed[file.path] ??= {
			previousSha256: previous.sha256, currentSha256: file.sha256
			, occurrences: 0
		};
		assert.equal(item.previousSha256, previous.sha256);
		assert.equal(item.currentSha256, file.sha256);
		item.occurrences++;
	}
assert.equal(Object.values(refreshed)
	.reduce((total, item) => total + item.occurrences, 0), pinned.refreshed);

const updates = [];
for(const path of implementationPaths)
	updates.push(await gitSourceHistoryTransition(path, predecessor
		, implementation, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(tmpdir()
	, "lean-reviewed-subtype-live-expectation-"));
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
		"git", arguments_, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024
			, env: environment, ...options });
	temporaryGit(["read-tree", implementation]);
	temporaryGit(["add", "--sparse", "--", ...integrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", implementation
	], { input: "Authenticate reviewed Subtype live expectation repair\n" })
		.trim();
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
		, milestone: "reviewed-subtype-live-expectation-v1"
		, predecessorCommit: predecessor, implementationCommit: implementation
		, integrationCommit
		, discovery: {
			run: 42307044361, firstJob: 128206501326
			, firstLane: "Perl / Perl XS (5.38.2-threaded)"
			, step: "Compare installed Perl corpus packages with fresh Lean results"
			, actual: "current reviewed result projections use constructor null"
			, expected: "the checker reconstructed the 2026-10-10 result constructors"
		}
		, rootCause: "The 0976959 historical-reader repair replaced the shared checker fixture with the frozen 2026-10-10 reviewed contract. Immutable archive replay became correct, but the same implicit expectation also judged freshly produced host records. Current output projects result refinements and selects ten input contracts; the frozen records retain twelve contracts with seven historical result constructors."
		, repair: "Require every report check to declare current or 2026-10-10 explicitly. Derive current compiler selection with reviewedSourceSelection, retain the frozen reconstruction only for archived evidence, pass current from the hosted shell, and reject cross-epoch substitution in focused tests."
		, behavior, exactModel, refreshed
		, changedSupportCells: 0, runtimeSemanticChanges: 0
		, validation: {
			archivedLanes: { tests: 2, pass: 2, fail: 0 }
			, archiveFamilies: { tests: 9, pass: 9, fail: 0 }
			, hostedArtifact: { lane: "perl-5.38.2-threaded"
				, checks: 2025, expectation: "current", pass: true }
			, lint: true, typecheck: true, diffCheck: true
		}
		, updates, integrationUpdates, historyAdditions: additions
	}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions; refreshed `
		+ `${pinned.refreshed} live source pins.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
