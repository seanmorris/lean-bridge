#!/usr/bin/env node
/**
 * Record the PHP-Wasm generic-record sparse-checkout repair.
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
	assertPhpWasmGenericRecordSparseCheckoutRepair
	, phpWasmGenericRecordSparseCheckoutRepairHistoryAdditions
	, phpWasmGenericRecordSparseCheckoutRepairHistoryPath
	, phpWasmGenericRecordSparseCheckoutRepairImplementation
	, phpWasmGenericRecordSparseCheckoutRepairImplementationPaths
	, phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths
	, phpWasmGenericRecordSparseCheckoutRepairPinPaths
	, phpWasmGenericRecordSparseCheckoutRepairPinRepair
	, phpWasmGenericRecordSparseCheckoutRepairPredecessor
} from "../tests/helpers/php-wasm-generic-record-sparse-checkout-repair-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-php-wasm-generic-record-sparse-checkout-repair-source-history.mjs");
assert.equal(existsSync(
	phpWasmGenericRecordSparseCheckoutRepairHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmGenericRecordSparseCheckoutRepairPinRepair);
assert.equal(git(["rev-parse"
	, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}^`]).trim()
, phpWasmGenericRecordSparseCheckoutRepairPredecessor);
assert.equal(git(["rev-parse"
	, `${phpWasmGenericRecordSparseCheckoutRepairPinRepair}^`]).trim()
, phpWasmGenericRecordSparseCheckoutRepairImplementation);
assert.deepEqual(names(["diff", "--name-only"
	, phpWasmGenericRecordSparseCheckoutRepairPredecessor
	, phpWasmGenericRecordSparseCheckoutRepairImplementation, "--"])
, [...phpWasmGenericRecordSparseCheckoutRepairImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, phpWasmGenericRecordSparseCheckoutRepairImplementation
	, phpWasmGenericRecordSparseCheckoutRepairPinRepair, "--"])
, [...phpWasmGenericRecordSparseCheckoutRepairPinPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths])
, [...phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmGenericRecordSparseCheckoutRepairHistoryAdditions])
, [...phpWasmGenericRecordSparseCheckoutRepairHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${phpWasmGenericRecordSparseCheckoutRepairPinRepair}:${
		phpWasmGenericRecordSparseCheckoutRepairHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSource = path => git(["show"
	, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:${path}`]);
const workflow = implementationSource(".github/workflows/consumer-matrix.yml");
const regression = implementationSource("tests/docker-consumer-ci.test.mjs");
assertPhpWasmGenericRecordSparseCheckoutRepair(workflow, regression);
const predecessorWorkflow = git(["show"
	, `${phpWasmGenericRecordSparseCheckoutRepairPredecessor}:.github/workflows/consumer-matrix.yml`]);
const archivePattern
	= "/docs/evidence/php-wasm-generic-records-20261007/";
assert.equal(predecessorWorkflow.includes(archivePattern), false);

const archiveRoot = "docs/evidence/php-wasm-generic-records-20261007";
const archiveFiles = [];
for(const path of [
	"fin-reserved-name-failure.tap", "ordinary.json", "ordinary.tap"
	, "receipt.json"
]) {
	const source = git(["show"
		, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:${
			archiveRoot}/${path}`]);
	archiveFiles.push({ path, bytes: Buffer.byteLength(source)
		, sha256: sha256(source) });
}
assert.equal(archiveFiles.reduce((sum, file) => sum + file.bytes, 0), 250321);

const beforeInventory = git(["show"
	, `${phpWasmGenericRecordSparseCheckoutRepairImplementation}:docs/type-surface.v1.json`]);
const afterInventory = git(["show"
	, `${phpWasmGenericRecordSparseCheckoutRepairPinRepair}:docs/type-surface.v1.json`]);
const workflowPin = {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: sha256(predecessorWorkflow), current: sha256(workflow)
};
assert.deepEqual(workflowPin, {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: "83d38737fa631ff9fbbd5b6079ca0b62a986bf703c8313df825043610ea098c2"
	, current: "ba0f065731e8be2ceb8ba01dd046eef8ed8b381e61ca8b5bd82b12ced4e853d1"
});
assert.equal(afterInventory.split(workflowPin.current).length - 1
	, workflowPin.count);
assert.equal(afterInventory.includes(workflowPin.previous), false);
assert.equal(afterInventory.replaceAll(
	workflowPin.current, workflowPin.previous), beforeInventory);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	phpWasmGenericRecordSparseCheckoutRepairPredecessor
	, phpWasmGenericRecordSparseCheckoutRepairImplementation
	, phpWasmGenericRecordSparseCheckoutRepairPinRepair
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of phpWasmGenericRecordSparseCheckoutRepairImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, phpWasmGenericRecordSparseCheckoutRepairPredecessor
		, phpWasmGenericRecordSparseCheckoutRepairImplementation));
const pinUpdates = [];
for(const path of phpWasmGenericRecordSparseCheckoutRepairPinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, phpWasmGenericRecordSparseCheckoutRepairImplementation
		, phpWasmGenericRecordSparseCheckoutRepairPinRepair
		, { maximumEditBytes: 256 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-sparse-history-"));
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
		, phpWasmGenericRecordSparseCheckoutRepairPinRepair]);
	temporaryGit(["add", "--sparse", "--"
		, ...phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, phpWasmGenericRecordSparseCheckoutRepairPinRepair
	], { input: "Authenticate PHP-Wasm sparse archive source\n" }).trim();
	const integrationUpdates = [];
	for(const path of phpWasmGenericRecordSparseCheckoutRepairIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, phpWasmGenericRecordSparseCheckoutRepairPinRepair
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of phpWasmGenericRecordSparseCheckoutRepairHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(phpWasmGenericRecordSparseCheckoutRepairHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-generic-record-sparse-checkout-repair-v1"
			, predecessorCommit:
				phpWasmGenericRecordSparseCheckoutRepairPredecessor
			, implementationCommit:
				phpWasmGenericRecordSparseCheckoutRepairImplementation
			, pinRepairCommit:
				phpWasmGenericRecordSparseCheckoutRepairPinRepair
			, integrationCommit
			, failedRun: {
				workflow: 41260205931, job: 124718137183
				, headSha: phpWasmGenericRecordSparseCheckoutRepairPredecessor
				, jobName: "PHP-Wasm corpus (refinements)"
			}
			, failure: "generic-record archive replay failed with ENOENT"
			, missingFiles: ["receipt.json", "ordinary.json"]
			, rootCause: "The PHP-Wasm generic-record test always replays its retained original archive, but the shared Consumer Matrix sparse checkout selected only top-level evidence metadata and nested index.json files. The php-wasm-corpus job therefore reached the semantic gate without the receipt and ordinary observation it is required to authenticate."
			, repair: {
				addedSparsePath: archivePattern, selectedFiles: archiveFiles
				, selectedBytes: 250321, observedMaterializedKiB: 256
				, regressionOwnsConsumer: true
			}
			, workflowPin
			, exactModel: {
				sha256: sha256(exactModels[0])
				, bytes: Buffer.byteLength(exactModels[0])
				, cells: exact.model.length, stageEntries: exact.stageEntries
			}
			, changedSupportCells: 0, runtimeSemanticChanges: 0
			, updates, pinUpdates, integrationUpdates, historyAdditions
		}), { flag: "wx" });
	process.stdout.write(`Recorded ${updates.length} implementation, `
		+ `${pinUpdates.length} pin and ${integrationUpdates.length} `
		+ "integration transitions for the PHP-Wasm sparse archive repair.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
