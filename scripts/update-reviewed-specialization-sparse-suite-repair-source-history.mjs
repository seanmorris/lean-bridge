#!/usr/bin/env node
/**
 * Record the reviewed-specialization sparse-suite separation repair.
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
	assertReviewedSpecializationSparseSuiteRepair
	, reviewedSpecializationSparseSuiteRepairHistoryAdditions
	, reviewedSpecializationSparseSuiteRepairHistoryPath
	, reviewedSpecializationSparseSuiteRepairImplementation
	, reviewedSpecializationSparseSuiteRepairImplementationPaths
	, reviewedSpecializationSparseSuiteRepairIntegrationPaths
	, reviewedSpecializationSparseSuiteRepairPredecessor
} from "../tests/helpers/reviewed-specialization-sparse-suite-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-reviewed-specialization-sparse-suite-repair-source-history.mjs");
assert.equal(existsSync(reviewedSpecializationSparseSuiteRepairHistoryPath)
	, false, "Reviewed-specialization sparse repair history already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, reviewedSpecializationSparseSuiteRepairImplementation);
assert.equal(git(["rev-parse"
	, `${reviewedSpecializationSparseSuiteRepairImplementation}^`]).trim()
, reviewedSpecializationSparseSuiteRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only"
	, reviewedSpecializationSparseSuiteRepairPredecessor
	, reviewedSpecializationSparseSuiteRepairImplementation, "--"])
, [...reviewedSpecializationSparseSuiteRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...reviewedSpecializationSparseSuiteRepairIntegrationPaths])
, [...reviewedSpecializationSparseSuiteRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...reviewedSpecializationSparseSuiteRepairHistoryAdditions])
, [...reviewedSpecializationSparseSuiteRepairHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${reviewedSpecializationSparseSuiteRepairImplementation}:${
		reviewedSpecializationSparseSuiteRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSources = {};
for(const path of reviewedSpecializationSparseSuiteRepairImplementationPaths)
	implementationSources[path] = git(["show"
		, `${reviewedSpecializationSparseSuiteRepairImplementation}:${path}`]);
assertReviewedSpecializationSparseSuiteRepair(implementationSources);
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	reviewedSpecializationSparseSuiteRepairPredecessor
	, reviewedSpecializationSparseSuiteRepairImplementation
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of reviewedSpecializationSparseSuiteRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, reviewedSpecializationSparseSuiteRepairPredecessor
		, reviewedSpecializationSparseSuiteRepairImplementation
		, { maximumEditBytes: 64 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-reviewed-specialization-sparse-suite-history-"));
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
	temporaryGit(["read-tree"
		, reviewedSpecializationSparseSuiteRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...reviewedSpecializationSparseSuiteRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, reviewedSpecializationSparseSuiteRepairImplementation
	], { input: "Authenticate reviewed-specialization sparse-suite repair\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of reviewedSpecializationSparseSuiteRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, reviewedSpecializationSparseSuiteRepairImplementation
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of reviewedSpecializationSparseSuiteRepairHistoryAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${reviewedSpecializationSparseSuiteRepairImplementation}:${path}`]
		, { stdio: "ignore" }).status, 0, path);
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	}
	const currentSourcePins = [
		{
			path: "tests/helpers/reviewed-api-promotion-tests.mjs", count: 4
			, previous: "15660aff35ece75f78af32fdc299d98076adadf0e715c53169448fe79802d147"
			, current: "6d3f726045ed2031806fcfacc4775edb7f16ef08e15330c43408719aa558c98e"
		}
		, {
			path: "tests/reviewed-specializations.test.mjs", count: 2
			, previous: "3cbcb36881906b9941633223e8ae2ae051fa430fc0ed93d854d9485e3eae53a8"
			, current: "78d93ca85fee348cb2f05b0a85d525219ff170c14a5bcc00574ee6abbceeb2d1"
		}
	];
	const inventory = await readFile("docs/type-surface.v1.json", "utf8");
	for(const pin of currentSourcePins)
	{
		assert.equal(inventory.split(pin.previous).length - 1, 0, pin.path);
		assert.equal(inventory.split(pin.current).length - 1
			, pin.count, pin.path);
	}
	await writeFile(reviewedSpecializationSparseSuiteRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "reviewed-specialization-sparse-suite-repair-source-v1"
			, predecessorCommit: reviewedSpecializationSparseSuiteRepairPredecessor
			, implementationCommit: reviewedSpecializationSparseSuiteRepairImplementation
			, integrationCommit
			, discovery: {
				workflow: 41303296188, job: 124844426391
				, lane: "Native consumer (c-family)"
				, failure: "the sparse runtime suite imported retained reviewed-specialization evidence that was intentionally absent from the consumer checkout"
			}
			, rootCause: "The reviewed-specializations runtime test directly imported two archived-evidence checks. Consumer jobs intentionally exclude retained evidence directories, so the C-family lane completed all current runtime work and then failed on two ENOENT reads from the October 8 archive."
			, repair: "Keep current reviewed-specialization runtime and package checks in the sparse consumer suite. Authenticate the retained archive through the existing Core-only reviewed API promotion suite, assert both registrations, and keep the retained directory excluded from consumer checkouts."
			, exactModel: {
				sha256: sha256(exactModels[0])
				, bytes: Buffer.byteLength(exactModels[0])
				, cells: exact.model.length, stageEntries: exact.stageEntries
			}
			, changedSupportCells: 0, runtimeSemanticChanges: 0
			, livePinRefreshes: 6, currentSourcePins
			, updates, integrationUpdates, historyAdditions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions for the `
		+ "reviewed-specialization sparse-suite repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
