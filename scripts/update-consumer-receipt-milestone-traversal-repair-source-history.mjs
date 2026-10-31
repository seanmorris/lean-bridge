#!/usr/bin/env node
/**
 * Record the exact consumer-receipt milestone traversal repair.
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
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import {
	assertConsumerReceiptMilestoneTraversalRepair
	, consumerReceiptMilestoneTraversalRepairHistoryAdditions
	, consumerReceiptMilestoneTraversalRepairHistoryPath
	, consumerReceiptMilestoneTraversalRepairImplementation
	, consumerReceiptMilestoneTraversalRepairImplementationPaths
	, consumerReceiptMilestoneTraversalRepairIntegrationPaths
	, consumerReceiptMilestoneTraversalRepairPredecessor
} from "../tests/helpers/consumer-receipt-milestone-traversal-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-receipt-milestone-traversal-repair-source-history.mjs");
assert.equal(existsSync(consumerReceiptMilestoneTraversalRepairHistoryPath)
	, false, consumerReceiptMilestoneTraversalRepairHistoryPath
		+ " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerReceiptMilestoneTraversalRepairImplementation);
assert.equal(git(["rev-parse"
	, consumerReceiptMilestoneTraversalRepairImplementation + "^"]).trim()
, consumerReceiptMilestoneTraversalRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerReceiptMilestoneTraversalRepairPredecessor
	, consumerReceiptMilestoneTraversalRepairImplementation, "--"])
, [...consumerReceiptMilestoneTraversalRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...consumerReceiptMilestoneTraversalRepairIntegrationPaths])
, [...consumerReceiptMilestoneTraversalRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerReceiptMilestoneTraversalRepairHistoryAdditions])
, [...consumerReceiptMilestoneTraversalRepairHistoryAdditions].sort());

const implementationSource = git(["show"
	, consumerReceiptMilestoneTraversalRepairImplementation + ":"
		+ consumerReceiptMilestoneTraversalRepairImplementationPaths[0]]);
assertConsumerReceiptMilestoneTraversalRepair(implementationSource);
const document = JSON.parse(await readFile("docs/type-surface.v1.json", "utf8"));
const liveFiles = typeSurfaceEvidenceFiles(document);
for(const path of consumerReceiptMilestoneTraversalRepairImplementationPaths)
	assert.equal(liveFiles.filter(file => file.path === path).length, 0, path);
const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, consumerReceiptMilestoneTraversalRepairImplementation + ":"
		+ exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of consumerReceiptMilestoneTraversalRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerReceiptMilestoneTraversalRepairPredecessor
		, consumerReceiptMilestoneTraversalRepairImplementation));
const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-receipt-milestone-traversal-"));
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
		, consumerReceiptMilestoneTraversalRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerReceiptMilestoneTraversalRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, consumerReceiptMilestoneTraversalRepairImplementation
	], { input: "Authenticate consumer receipt milestone traversal\n" }).trim();
	const integrationUpdates = [];
	for(const path of consumerReceiptMilestoneTraversalRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerReceiptMilestoneTraversalRepairImplementation
			, integrationCommit));
	const historyAdditions = [];
	for(const path of consumerReceiptMilestoneTraversalRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(consumerReceiptMilestoneTraversalRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone:
				"consumer-receipt-milestone-traversal-repair-source-v1"
			, predecessorCommit:
				consumerReceiptMilestoneTraversalRepairPredecessor
			, implementationCommit:
				consumerReceiptMilestoneTraversalRepairImplementation
			, integrationCommit
			, failure: {
				tests: 99, passed: 98, failed: 1
				, test:
					"downstream receipt repair refreshes exactly 96 live citations"
				, path: ".github/workflows/consumer-matrix.yml"
				, expectedPins: 92, observedPins: 0
			}
			, rootCause: "The immutable consumer-receipt test peeled only one named documentation layer from the current type-surface document. Later authenticated live-pin transitions changed that document again, so the test compared the current state with an obsolete intermediate digest instead of traversing the complete history hub to its own recorded integration milestone."
			, scope: "Resolve the exact recorded type-surface integration digest through the complete source-history traversal before checking the 96 historical pin replacements. Preserve every source transition, support cell, stage, evidence identity, package API and frozen #1220 model."
			, changedSupportCells: 0, semanticChanges: 0
			, exactModel: {
				sha256: sha256(exactModel)
				, bytes: Buffer.byteLength(exactModel)
				, cells: exact.model.length, stageEntries: exact.stageEntries
			}
			, focusedTests: { passed: 8, failed: 0, skipped: 0 }
			, updates, integrationUpdates, historyAdditions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation and `
		+ `${integrationUpdates.length} integration transitions.\n`);
}
finally
{
	await rm(directory, { recursive: true, force: true });
}
