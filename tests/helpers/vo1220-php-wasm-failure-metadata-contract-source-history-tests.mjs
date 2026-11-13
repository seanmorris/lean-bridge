/**
 * Authenticate the PHP-Wasm failure-metadata contract repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import {
	beforeVo1220PhpWasmFailureMetadataContractSource
	, reverseVo1220PhpWasmFailureMetadataContractUpdate
	, vo1220PhpWasmFailureMetadataContractAddedPaths
	, vo1220PhpWasmFailureMetadataContractHistoryPath
	, vo1220PhpWasmFailureMetadataContractImplementation
	, vo1220PhpWasmFailureMetadataContractImplementationPaths
	, vo1220PhpWasmFailureMetadataContractIntegrationPaths
	, vo1220PhpWasmFailureMetadataContractNormalizationPaths
	, vo1220PhpWasmFailureMetadataContractPredecessor
} from "./vo1220-php-wasm-failure-metadata-contract-source-history.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const sourceAt = (commit, path) => git(["show", `${commit}:${path}`]);
const record = async () => JSON.parse(await readFile(
	vo1220PhpWasmFailureMetadataContractHistoryPath, "utf8"));

test("PHP-Wasm failure-metadata repair binds the exact hosted failure"
	, async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "vo1220-php-wasm-failure-metadata-contract-v1");
	assert.equal(history.predecessorCommit
		, vo1220PhpWasmFailureMetadataContractPredecessor);
	assert.equal(history.implementationCommit
		, vo1220PhpWasmFailureMetadataContractImplementation);
	assert.deepEqual(history.hostedFailure, {
		run: 43346955036, job: 131635980048
		, workflow: "Core quality contract"
		, jobName: "Contract shard 3/12"
		, failingTest:
			"recursive PHP-Wasm diagnostics retain original files and code or signal"
		, failure: "Expected values to be strictly deep-equal"
	});
	assert.deepEqual(history.validation, {
		directHelper: { tests: 8, passed: 8, failed: 0 }
		, generatedRegistration: { tests: 9, passed: 8, failed: 0, skipped: 1 }
		, partitionRegistration: { tests: 14, passed: 14, failed: 0 }
		, exactHistory: { tests: 5, passed: 5, failed: 0 }
		, repairHistory: { tests: 4, passed: 4, failed: 0 }
		, scopedLint: "passed"
	});
	assert.deepEqual(history.updates.map(update => update.path)
		, vo1220PhpWasmFailureMetadataContractImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(update => update.path)
		, vo1220PhpWasmFailureMetadataContractIntegrationPaths);
	}
);

test("PHP-Wasm failure-metadata repair requires the complete bounded shape"
	, () => {
	const source = sourceAt(
		vo1220PhpWasmFailureMetadataContractImplementation
		, "tests/helpers/php-wasm-recursive-failure-evidence-tests.mjs");
	for(const marker of [
		'outputPolicy: "fail"', "stdoutBytes: 0", "stderrBytes: 0"
		, "stdoutTruncated: false", "stderrTruncated: false"
	]) assert.match(source, new RegExp(marker), marker);
	assert.equal(source.match(/process[.](exit|kill)/gu)?.length, 2);
	}
);

test("PHP-Wasm failure-metadata repair reverses every transition"
	, async () => {
	const history = await record();
	for(const update of history.updates)
	{
		const current = sourceAt(
			vo1220PhpWasmFailureMetadataContractImplementation, update.path);
		const previous = sourceAt(
			vo1220PhpWasmFailureMetadataContractPredecessor, update.path);
		assert.equal(reverseVo1220PhpWasmFailureMetadataContractUpdate(
			current, update), previous, update.path);
		assert.equal(beforeVo1220PhpWasmFailureMetadataContractSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = sourceAt(
			vo1220PhpWasmFailureMetadataContractImplementation, update.path);
		assert.equal(reverseVo1220PhpWasmFailureMetadataContractUpdate(
			current, update), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
	for(const path of vo1220PhpWasmFailureMetadataContractNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path), path);
	}
);

test("PHP-Wasm failure-metadata repair rejects forgeries and duplicate writers"
	, async t => {
	const history = await record();
	assert.deepEqual(history.additions.map(addition => addition.path)
		, vo1220PhpWasmFailureMetadataContractAddedPaths);
	for(const addition of history.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
	const update = history.updates[0];
	const current = sourceAt(
		vo1220PhpWasmFailureMetadataContractImplementation, update.path);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseVo1220PhpWasmFailureMetadataContractUpdate(current, forged));
	const root = await mkdtemp(
		`${tmpdir()}/vo1220-php-wasm-failure-metadata-`);
	t.after(() => rm(root, { recursive: true }));
	const duplicate = spawnSync(process.execPath, [resolve(
		"scripts/update-vo1220-php-wasm-failure-metadata-contract-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(duplicate.status, 0);
	assert.equal(duplicate.stdout, "");
	assert.deepEqual(await readdir(root), []);
	}
);
