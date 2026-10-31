#!/usr/bin/env node
/**
 * Record the reviewed-corpus documentation contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalJson, sha256 } from "../src/capsule/node.mjs";
import { typeSurfaceEvidenceFiles }
	from "../src/adoption/type-surface-evidence-receipt.mjs";
import {
	assertReviewedCorpusReceiptContract
	, consumerTypeSurfaceDocumentationContractRepairHistoryAdditions
	, consumerTypeSurfaceDocumentationContractRepairHistoryPath
	, consumerTypeSurfaceDocumentationContractRepairImplementation
	, consumerTypeSurfaceDocumentationContractRepairImplementationPaths
	, consumerTypeSurfaceDocumentationContractRepairIntegrationPaths
	, consumerTypeSurfaceDocumentationContractRepairPredecessor
} from "../tests/helpers/consumer-type-surface-documentation-contract-repair-source-history.mjs";
import { gitSourceHistoryTransition }
	from "../tests/helpers/source-history-stream.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-consumer-type-surface-documentation-contract-repair-source-history.mjs");
assert.equal(existsSync(
	consumerTypeSurfaceDocumentationContractRepairHistoryPath), false
, consumerTypeSurfaceDocumentationContractRepairHistoryPath
		+ " already exists");
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, consumerTypeSurfaceDocumentationContractRepairImplementation);
assert.equal(git(["rev-parse"
	, consumerTypeSurfaceDocumentationContractRepairImplementation
		+ "^"]).trim()
, consumerTypeSurfaceDocumentationContractRepairPredecessor);
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=M"
	, consumerTypeSurfaceDocumentationContractRepairPredecessor
	, consumerTypeSurfaceDocumentationContractRepairImplementation, "--"])
, [...consumerTypeSurfaceDocumentationContractRepairImplementationPaths]
		.sort());
assert.deepEqual(names(["diff", "--name-only", "--diff-filter=A"
	, consumerTypeSurfaceDocumentationContractRepairPredecessor
	, consumerTypeSurfaceDocumentationContractRepairImplementation, "--"]), []);
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--"
	, ...consumerTypeSurfaceDocumentationContractRepairIntegrationPaths])
, [...consumerTypeSurfaceDocumentationContractRepairIntegrationPaths]
		.sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...consumerTypeSurfaceDocumentationContractRepairHistoryAdditions])
, [...consumerTypeSurfaceDocumentationContractRepairHistoryAdditions]
		.sort());

const inventoryPath = "docs/type-surface.v1.json";
const beforeInventory = git(["show"
	, consumerTypeSurfaceDocumentationContractRepairImplementation
		+ ":" + inventoryPath]);
const afterInventory = await readFile(inventoryPath, "utf8");
const currentSourcePin = {
	path: "tests/documentation.test.mjs", count: 25
	, previous: sha256(git(["show"
		, consumerTypeSurfaceDocumentationContractRepairPredecessor
			+ ":tests/documentation.test.mjs"]))
	, current: sha256(git(["show"
		, consumerTypeSurfaceDocumentationContractRepairImplementation
			+ ":tests/documentation.test.mjs"]))
};
assert.equal(currentSourcePin.previous
	, "38f5c3a97a230c3865d7c16124bbc2a55c1f0eda3ca2ff44a34417cf7bf5b8d6");
assert.equal(currentSourcePin.current
	, "9d558637d133b355f831772df6e72e1fd0e9274c13608ae1b1851b69e8345a1d");
assert.equal(afterInventory.split(currentSourcePin.current).length - 1
	, currentSourcePin.count);
assert.equal(afterInventory.includes(currentSourcePin.previous), false);
assert.equal(afterInventory.replaceAll(
	currentSourcePin.current, currentSourcePin.previous), beforeInventory);

const document = JSON.parse(afterInventory);
const liveFiles = typeSurfaceEvidenceFiles(document).filter(file =>
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

const workflow = git(["show"
	, consumerTypeSurfaceDocumentationContractRepairImplementation
		+ ":.github/workflows/consumer-matrix.yml"]);
const reviewedJob = workflow.split("  reviewed-ir-admission:\n")[1]
	.split("  nix-cache:\n")[0];
assertReviewedCorpusReceiptContract(reviewedJob);

const immutablePath
	= "docs/evidence/consumer-docker-source-closure-source-history-20261031.json";
const immutableSource = await readFile(immutablePath, "utf8");
assert.equal(immutableSource, git(["show"
	, consumerTypeSurfaceDocumentationContractRepairImplementation
		+ ":" + immutablePath]));
assert.equal(immutableSource.includes(currentSourcePin.previous), true);
assert.equal(immutableSource.includes(currentSourcePin.current), false);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModel = git(["show"
	, consumerTypeSurfaceDocumentationContractRepairImplementation
		+ ":" + exactModelPath]);
assert.equal(sha256(exactModel)
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModel), 16916757);
const exact = JSON.parse(exactModel);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of
	consumerTypeSurfaceDocumentationContractRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, consumerTypeSurfaceDocumentationContractRepairPredecessor
		, consumerTypeSurfaceDocumentationContractRepairImplementation
		, { maximumEditBytes: 256 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-consumer-type-surface-documentation-contract-repair-"));
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
		, consumerTypeSurfaceDocumentationContractRepairImplementation]);
	temporaryGit(["add", "--sparse", "--"
		, ...consumerTypeSurfaceDocumentationContractRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, consumerTypeSurfaceDocumentationContractRepairImplementation
	], { input: "Authenticate reviewed-corpus documentation contract repair\n" })
		.trim();
	const integrationUpdates = [];
	for(const path of
		consumerTypeSurfaceDocumentationContractRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(
			path, consumerTypeSurfaceDocumentationContractRepairImplementation
			, integrationCommit, { maximumEditBytes: 256 * 1024 * 1024 }
		));
	const historyAdditions = [];
	for(const path of
		consumerTypeSurfaceDocumentationContractRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(
		consumerTypeSurfaceDocumentationContractRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone:
				"consumer-type-surface-documentation-contract-repair-v1"
			, predecessorCommit:
				consumerTypeSurfaceDocumentationContractRepairPredecessor
			, implementationCommit:
				consumerTypeSurfaceDocumentationContractRepairImplementation
			, failedRun: {
				workflow: 41222778612
				, headSha:
					consumerTypeSurfaceDocumentationContractRepairPredecessor
			}
			, failure: {
				job: 124600962626, name: "Documentation contract"
				, completedAt: "2026-10-31T17:26:23Z"
				, test:
					"consumer CI history preserves every consumer and pinned build path"
				, staleExpectation:
					"The reviewed IR job must not use sparse checkout."
			}
			, rootCause: "The reviewed IR job deliberately moved to the bounded sparse checkout and authenticated type-surface receipt, while its documentation contract still required the retired complete-checkout shape."
			, contract: {
				dependency: "type-surface-authentication"
				, checkoutDepth: 1, sparseCheckout: true, coneMode: false
				, receiptArtifact: "consumer-type-surface-${{ github.sha }}"
				, receiptPath: "build/consumer-type-surface/receipt.json"
				, receiptEnvironment:
					"LEAN_BRIDGE_TYPE_SURFACE_EVIDENCE_RECEIPT"
				, restoreBeforeBind: true, bindBeforeExecution: true
			}
			, scope: "Replace the stale full-checkout documentation assertion with the exact bounded reviewed-corpus contract already used by the current workflow: one-depth non-cone sparse checkout, an explicit producer dependency, one exact commit-bound receipt restore, one receipt binding, and binding before reviewed corpus execution. Compose the predecessor receipt-repair test through this newer history layer. Refresh exactly 25 live citations for the documentation contract without changing the workflow, runtime, package API, support cell, stage, observation, immutable prior receipt or frozen #1220 model."
			, immutableEvidence: {
				path: immutablePath, sha256: sha256(immutableSource)
				, retainedHistoricalPin: currentSourcePin.previous
			}
			, liveFiles: liveFiles.length, remainingMismatches: 0
			, missingLiveFiles: 0, refreshedPins: 25, currentSourcePin
			, exactModel: {
				sha256: sha256(exactModel), bytes: Buffer.byteLength(exactModel)
				, cells: exact.model.length, stageEntries: exact.stageEntries
			}
			, updates, integrationUpdates, historyAdditions
		}), { flag: "wx" });
	process.stdout.write("Recorded " + updates.length
		+ " implementation transition, " + integrationUpdates.length
		+ " integration transitions and 25 live source pins.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
