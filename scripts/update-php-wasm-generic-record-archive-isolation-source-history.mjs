#!/usr/bin/env node
/**
 * Record the job-scoped PHP-Wasm generic-record archive repair.
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
	assertPhpWasmGenericRecordArchiveIsolation
	, phpWasmGenericRecordArchiveIsolationHistoryAdditions
	, phpWasmGenericRecordArchiveIsolationHistoryPath
	, phpWasmGenericRecordArchiveIsolationImplementation
	, phpWasmGenericRecordArchiveIsolationImplementationPaths
	, phpWasmGenericRecordArchiveIsolationIntegrationPaths
	, phpWasmGenericRecordArchiveIsolationPinPaths
	, phpWasmGenericRecordArchiveIsolationPinRepair
	, phpWasmGenericRecordArchiveIsolationPredecessor
} from "../tests/helpers/php-wasm-generic-record-archive-isolation-source-history.mjs";

const git = (arguments_, options = {}) => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024, ...options
});
const names = arguments_ => git(arguments_).trim().split("\n")
	.filter(Boolean).sort();
assert.deepEqual(process.argv.slice(2), []
	, "Usage: update-php-wasm-generic-record-archive-isolation-source-history.mjs");
assert.equal(existsSync(
	phpWasmGenericRecordArchiveIsolationHistoryPath), false);
assert.equal(git(["rev-parse", "HEAD"]).trim()
	, phpWasmGenericRecordArchiveIsolationPinRepair);
assert.equal(git(["rev-parse"
	, `${phpWasmGenericRecordArchiveIsolationImplementation}^`]).trim()
, phpWasmGenericRecordArchiveIsolationPredecessor);
assert.equal(git(["rev-parse"
	, `${phpWasmGenericRecordArchiveIsolationPinRepair}^`]).trim()
, phpWasmGenericRecordArchiveIsolationImplementation);
assert.deepEqual(names(["diff", "--name-only"
	, phpWasmGenericRecordArchiveIsolationPredecessor
	, phpWasmGenericRecordArchiveIsolationImplementation, "--"])
, [...phpWasmGenericRecordArchiveIsolationImplementationPaths].sort());
assert.deepEqual(names(["diff", "--name-only"
	, phpWasmGenericRecordArchiveIsolationImplementation
	, phpWasmGenericRecordArchiveIsolationPinRepair, "--"])
, [...phpWasmGenericRecordArchiveIsolationPinPaths].sort());
assert.deepEqual(names(["diff", "HEAD", "--name-only", "--diff-filter=M"
	, "--", ...phpWasmGenericRecordArchiveIsolationIntegrationPaths])
, [...phpWasmGenericRecordArchiveIsolationIntegrationPaths].sort());
assert.deepEqual(names(["ls-files", "--others", "--exclude-standard", "--"
	, ...phpWasmGenericRecordArchiveIsolationHistoryAdditions])
, [...phpWasmGenericRecordArchiveIsolationHistoryAdditions].sort());
assert.notEqual(spawnSync("git", ["cat-file", "-e"
	, `${phpWasmGenericRecordArchiveIsolationPinRepair}:${
		phpWasmGenericRecordArchiveIsolationHistoryPath}`]
, { stdio: "ignore" }).status, 0);

const implementationSource = path => git(["show"
	, `${phpWasmGenericRecordArchiveIsolationImplementation}:${path}`]);
const workflow = implementationSource(".github/workflows/consumer-matrix.yml");
const regression = implementationSource("tests/docker-consumer-ci.test.mjs");
assertPhpWasmGenericRecordArchiveIsolation(workflow, regression);
const predecessorWorkflow = git(["show"
	, `${phpWasmGenericRecordArchiveIsolationPredecessor}:.github/workflows/consumer-matrix.yml`]);
assert.equal(predecessorWorkflow.split(
	"docs/evidence/php-wasm-generic-records-20261007").length - 1, 1);

const beforeInventory = git(["show"
	, `${phpWasmGenericRecordArchiveIsolationImplementation}:docs/type-surface.v1.json`]);
const afterInventory = git(["show"
	, `${phpWasmGenericRecordArchiveIsolationPinRepair}:docs/type-surface.v1.json`]);
const workflowPin = {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: sha256(predecessorWorkflow), current: sha256(workflow)
};
assert.deepEqual(workflowPin, {
	path: ".github/workflows/consumer-matrix.yml", count: 92
	, previous: "ba0f065731e8be2ceb8ba01dd046eef8ed8b381e61ca8b5bd82b12ced4e853d1"
	, current: "7e842a6dd36ee897a3defaaa40546ed7079c37ac4b85511839a947818798badd"
});
assert.equal(afterInventory.split(workflowPin.current).length - 1
	, workflowPin.count);
assert.equal(afterInventory.includes(workflowPin.previous), false);
assert.equal(afterInventory.replaceAll(
	workflowPin.current, workflowPin.previous), beforeInventory);

const exactModelPath = "docs/evidence/vo1220-exact-type-surface-v1.json";
const exactModels = [
	phpWasmGenericRecordArchiveIsolationPredecessor
	, phpWasmGenericRecordArchiveIsolationImplementation
	, phpWasmGenericRecordArchiveIsolationPinRepair
].map(commit => git(["show", `${commit}:${exactModelPath}`]));
assert.equal(new Set(exactModels.map(source => sha256(source))).size, 1);
assert.equal(sha256(exactModels[0])
	, "1cb3a48a20d25345634fdcab7007970efbef27427344be5a7028b3a033a8c82f");
assert.equal(Buffer.byteLength(exactModels[0]), 16916757);
const exact = JSON.parse(exactModels[0]);
assert.equal(exact.model.length, 1054);
assert.equal(exact.stageEntries, 5270);

const updates = [];
for(const path of phpWasmGenericRecordArchiveIsolationImplementationPaths)
	updates.push(await gitSourceHistoryTransition(path
		, phpWasmGenericRecordArchiveIsolationPredecessor
		, phpWasmGenericRecordArchiveIsolationImplementation));
const pinUpdates = [];
for(const path of phpWasmGenericRecordArchiveIsolationPinPaths)
	pinUpdates.push(await gitSourceHistoryTransition(path
		, phpWasmGenericRecordArchiveIsolationImplementation
		, phpWasmGenericRecordArchiveIsolationPinRepair
		, { maximumEditBytes: 256 * 1024 * 1024 }));

const directory = await mkdtemp(join(
	tmpdir(), "lean-php-wasm-archive-isolation-history-"));
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
		, phpWasmGenericRecordArchiveIsolationPinRepair]);
	temporaryGit(["add", "--sparse", "--"
		, ...phpWasmGenericRecordArchiveIsolationIntegrationPaths]);
	const tree = temporaryGit(["write-tree"]).trim();
	const integrationCommit = temporaryGit([
		"commit-tree", tree, "-p"
		, phpWasmGenericRecordArchiveIsolationPinRepair
	], { input: "Authenticate job-scoped PHP-Wasm replay archive\n" }).trim();
	const integrationUpdates = [];
	for(const path of phpWasmGenericRecordArchiveIsolationIntegrationPaths)
		integrationUpdates.push(await gitSourceHistoryTransition(path
			, phpWasmGenericRecordArchiveIsolationPinRepair
			, integrationCommit, { maximumEditBytes: 64 * 1024 * 1024 }));
	const historyAdditions = [];
	for(const path of phpWasmGenericRecordArchiveIsolationHistoryAdditions)
		historyAdditions.push({ path, sha256: sha256(await readFile(path)) });
	await writeFile(phpWasmGenericRecordArchiveIsolationHistoryPath
		, canonicalJson({
			schemaVersion: 1
			, milestone: "php-wasm-generic-record-archive-isolation-v1"
			, predecessorCommit:
				phpWasmGenericRecordArchiveIsolationPredecessor
			, implementationCommit:
				phpWasmGenericRecordArchiveIsolationImplementation
			, pinRepairCommit:
				phpWasmGenericRecordArchiveIsolationPinRepair
			, integrationCommit
			, failedJobs: [
				{ workflow: 41268569577, job: 124742205648
					, headSha: phpWasmGenericRecordArchiveIsolationPredecessor
					, jobName: "Reviewed Fin Wasm entry (probe)" }
				, { workflow: 41268569577, job: 124742205749
					, headSha: phpWasmGenericRecordArchiveIsolationPredecessor
					, jobName: "Native consumer (python)" }
			]
			, failure: "shared source closure rejected ordinary.tap as retained payload"
			, rootCause: "The prior repair added the four-file generic-record archive to the shared Consumer Matrix sparse checkout. Every Nix job therefore materialized a retained TAP payload before running the global metadata-only source-closure check, which correctly failed before unrelated semantic execution."
			, repair: {
				sharedCheckoutMetadataOnly: true
				, retainedPayloadRefusalUnchanged: true
				, materializedJob: "php-wasm-corpus"
				, materializedProfile: "refinements"
				, afterSourceClosureCheck: true
				, selectedFiles: [
					"fin-reserved-name-failure.tap", "ordinary.json"
					, "ordinary.tap", "receipt.json"
				]
				, selectedBytes: 250321
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
		+ "integration transitions for PHP-Wasm archive isolation.\n");
}
finally
{ await rm(directory, { recursive: true, force: true }); }
