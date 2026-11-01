#!/usr/bin/env node
/**
 * Record the historical citation-transition audit repair.
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
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";
import {
	assertHistoricalCitationTransitionAudit
	, historicalCitationTransitionAuditHistoryAdditions
	, historicalCitationTransitionAuditHistoryPath
	, historicalCitationTransitionAuditImplementation
	, historicalCitationTransitionAuditImplementationPaths
	, historicalCitationTransitionAuditIntegrationPaths
	, historicalCitationTransitionAuditPredecessor
} from "../tests/helpers/historical-citation-transition-audit-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-historical-citation-transition-audit-source-history.mjs");
assert.equal(existsSync(historicalCitationTransitionAuditHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, historicalCitationTransitionAuditImplementation);
assert.equal(git(["rev-parse"
	, `${historicalCitationTransitionAuditImplementation}^`]).trim()
, historicalCitationTransitionAuditPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, historicalCitationTransitionAuditPredecessor
	, historicalCitationTransitionAuditImplementation, "--"])
, [...historicalCitationTransitionAuditImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...historicalCitationTransitionAuditIntegrationPaths])
, [...historicalCitationTransitionAuditIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...historicalCitationTransitionAuditHistoryAdditions])
, [...historicalCitationTransitionAuditHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${historicalCitationTransitionAuditImplementation}:${
		historicalCitationTransitionAuditHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSource = path => git(["show"
	, `${historicalCitationTransitionAuditImplementation}:${path}`]);
assertHistoricalCitationTransitionAudit(implementationSource(
	historicalCitationTransitionAuditImplementationPaths[0]));

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	historicalCitationTransitionAuditPredecessor
	, historicalCitationTransitionAuditImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of historicalCitationTransitionAuditImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, historicalCitationTransitionAuditPredecessor
		, historicalCitationTransitionAuditImplementation));

const directory = await mkdtemp(join(
	tmpdir(), "lean-historical-citation-audit-history-"));
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
	temporaryGit(["read-tree", historicalCitationTransitionAuditImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...historicalCitationTransitionAuditIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p", historicalCitationTransitionAuditImplementation
	], { input: "Authenticate historical citation transition audit\n" }).trim();
	const integrationUpdates = [];
	for(const path of historicalCitationTransitionAuditIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, historicalCitationTransitionAuditImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of historicalCitationTransitionAuditHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(historicalCitationTransitionAuditHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "historical-citation-transition-audit-v1"
			, predecessorCommit: historicalCitationTransitionAuditPredecessor
			, implementationCommit: historicalCitationTransitionAuditImplementation
			, integrationCommit
			, discovery: {
				partition: "tests/checked-javascript-partition-11.test.mjs"
				, contract: "reviewed-corpus contract repair refreshes exactly 25 live citations"
				, expectedPins: 25, observedPinsAfterPartialNormalization: 0
			}
			, rootCause: "A historical transition test tried to reconstruct its milestone by applying a hand-picked subset of newer normalizers to today's inventory. Later authenticated layers outside that subset moved the same pins, so the test no longer observed its own recorded digest even though its immutable transition remained valid."
			, repair: {
				path: "docs/type-surface.v1.json", exactPins: 25
				, currentStateDelegatedTo: "current live-source inventory audit"
			}
			, exactModel: {
				sha256: sha256(exactModels[0])
				, bytes: Buffer.byteLength(exactModels[0])
				, cells: exact.model.length, stageEntries: exact.stageEntries
			}
			, changedSupportCells: 0, runtimeSemanticChanges: 0
			, updates, integrationUpdates, historyAdditions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "historical citation audit.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
