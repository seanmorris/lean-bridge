#!/usr/bin/env node
/**
 * Record complete live-source pin aggregation and reconciliation.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import { reconcileDependentCheckedRecordSourcePins }
	from "../tests/helpers/dependent-checked-record-promotion.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	coreLiveSourcePinAggregationHistoryAdditions
	, coreLiveSourcePinAggregationHistoryPath
	, coreLiveSourcePinAggregationImplementation
	, coreLiveSourcePinAggregationImplementationPaths
	, coreLiveSourcePinAggregationIntegrationPaths
	, coreLiveSourcePinAggregationPredecessor
} from "../tests/helpers/core-live-source-pin-aggregation-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-core-live-source-pin-aggregation-source-history.mjs");
assert.equal(existsSync(coreLiveSourcePinAggregationHistoryPath), false
	, coreLiveSourcePinAggregationHistoryPath + " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, coreLiveSourcePinAggregationImplementation);
assert.equal(git(["rev-parse"
	, coreLiveSourcePinAggregationImplementation + "^"]).trim()
, coreLiveSourcePinAggregationPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, coreLiveSourcePinAggregationPredecessor
	, coreLiveSourcePinAggregationImplementation, "--"])
, [...coreLiveSourcePinAggregationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, coreLiveSourcePinAggregationPredecessor
	, coreLiveSourcePinAggregationImplementation, "--"]), []);
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, coreLiveSourcePinAggregationImplementation + ":"
		+ coreLiveSourcePinAggregationHistoryPath]
, { stdio: "ignore" }).status, 0);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...coreLiveSourcePinAggregationIntegrationPaths])
, [...coreLiveSourcePinAggregationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...coreLiveSourcePinAggregationHistoryAdditions])
, [...coreLiveSourcePinAggregationHistoryAdditions].sort());

const inventoryPath = "docs/type-surface.v1.json";
const beforeText = git(["show"
	, coreLiveSourcePinAggregationPredecessor + ":" + inventoryPath]);
const afterText = git(["show"
	, coreLiveSourcePinAggregationImplementation + ":" + inventoryPath]);
const before = JSON.parse(beforeText), after = JSON.parse(afterText);
const currentSourcePaths = [
	"src/adoption/type-surface.mjs"
	, "tests/type-surface-docs.test.mjs"
	, "tests/type-surface.test.mjs"
];
const currentDigests = new Map(currentSourcePaths.map(path => [path
	, sha256(git(["show"
		, coreLiveSourcePinAggregationImplementation + ":" + path]))]));
const reconciled = reconcileDependentCheckedRecordSourcePins(
	before, currentDigests);
assert.equal(reconciled.refreshed, 60);
assert.deepEqual(after, reconciled.inventory);
assert.deepEqual(after.profiles, before.profiles);
assert.deepEqual(after.observations, before.observations);
const currentSourcePins = currentSourcePaths.map(path => {
	const citations = before.evidence.flatMap(evidence => evidence.files)
		.filter(file => file.path === path);
	assert.ok(citations.length > 0, path);
	assert.equal(new Set(citations.map(file => file.sha256)).size, 1, path);
	return { path, count: citations.length, previous: citations[0].sha256
		, current: currentDigests.get(path) };
});
assert.deepEqual(currentSourcePins.map(item => item.count), [1, 24, 35]);

const liveFiles = typeSurfaceEvidenceFiles(after).filter(file =>
	!file.path.startsWith("docs/evidence/"));
const mismatches = [], missing = [];
for(let offset = 0; offset < liveFiles.length; offset += 16)
{
	const batch = liveFiles.slice(offset, offset + 16);
	const actual = await Promise.all(batch.map(async file => {
		try
		{
			return createHash("sha256").update(
				await readFile(file.path)).digest("hex");
		}
		catch(error)
		{ missing.push({ path: file.path, code: error.code }); return null; }
	}));
	for(const [index, file] of batch.entries())
		if(actual[index] !== null && actual[index] !== file.sha256)
			mismatches.push({
				path: file.path, actual: actual[index], expected: file.sha256
			});
}
assert.equal(liveFiles.length, 2661);
assert.deepEqual(missing, []);
assert.deepEqual(mismatches, []);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, coreLiveSourcePinAggregationImplementation + ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of coreLiveSourcePinAggregationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, coreLiveSourcePinAggregationPredecessor
		, coreLiveSourcePinAggregationImplementation
		, { maximumEditBytes: 128 * 1024 * 1024 }));
const directory = await mkdtemp(join(
	tmpdir(), "lean-core-live-source-pin-aggregation-"));
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
	temporaryGit(["read-tree", coreLiveSourcePinAggregationImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...coreLiveSourcePinAggregationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", coreLiveSourcePinAggregationImplementation
	], { input: "Authenticate live-source pin aggregation\n" }).trim();
	const integrationUpdates = [];
	for(const path of coreLiveSourcePinAggregationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, coreLiveSourcePinAggregationImplementation, integrationCommit
			, { maximumEditBytes: 128 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of coreLiveSourcePinAggregationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(coreLiveSourcePinAggregationHistoryPath, canonicalJson({
		schemaVersion: 1
		, milestone: "core-live-source-pin-aggregation-source-v1"
		, predecessorCommit: coreLiveSourcePinAggregationPredecessor
		, implementationCommit: coreLiveSourcePinAggregationImplementation
		, failedRun: { workflow: 41177050728, job: 124470173666 }
		, failure: "stale source evidence: tests/type-surface-docs.test.mjs"
		, scope: "Authenticate all 2,661 current live-source paths in one pass, report every digest mismatch instead of stopping at the first stale citation, and reconcile the complete three-path, 60-pin cohort exposed by exact-head Core. Preserve every support observation, cell, stage, evidence identity and immutable archive, including the frozen 1,054-cell and 5,270-stage #1220 model."
		, liveFiles: liveFiles.length, stalePaths: currentSourcePaths.length
		, refreshedPins: reconciled.refreshed, remainingMismatches: 0
		, missingLiveFiles: 0, aggregateFailures: true, currentSourcePins
		, exactModel: {
			sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
			, cells: exact.model.length, stageEntries: exact.stageEntries
		}
		, updates, integrationUpdates, historyAdditions
	}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transitions, " + integrationUpdates.length
		+ " integration transitions and 60 refreshed pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
