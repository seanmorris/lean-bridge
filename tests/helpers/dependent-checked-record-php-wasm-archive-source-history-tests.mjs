/**
 * Authenticate the hosted PHP-Wasm dependent checked-record archive history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";
import {
	beforeDependentCheckedRecordPhpWasmArchiveSource
	, dependentCheckedRecordPhpWasmArchiveAddedFileCount
	, dependentCheckedRecordPhpWasmArchiveFileCount
	, dependentCheckedRecordPhpWasmArchiveFoundationAddedPaths
	, dependentCheckedRecordPhpWasmArchiveHistoryPath
	, dependentCheckedRecordPhpWasmArchiveImplementation
	, dependentCheckedRecordPhpWasmArchiveImplementationPaths
	, dependentCheckedRecordPhpWasmArchiveIndexSha256
	, dependentCheckedRecordPhpWasmArchiveIndexedFileCount
	, dependentCheckedRecordPhpWasmArchiveIntegrationPaths
	, dependentCheckedRecordPhpWasmArchivePredecessor
	, dependentCheckedRecordPhpWasmArchiveRoot
	, reverseDependentCheckedRecordPhpWasmArchiveImplementation
	, reverseDependentCheckedRecordPhpWasmArchiveIntegration
} from "./dependent-checked-record-php-wasm-archive-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent PHP-Wasm archive history restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpWasmArchiveHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-php-wasm-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPhpWasmArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPhpWasmArchiveImplementation);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordPhpWasmArchiveRoot
		, indexSha256: dependentCheckedRecordPhpWasmArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordPhpWasmArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordPhpWasmArchiveFileCount
		, addedFileCount: dependentCheckedRecordPhpWasmArchiveAddedFileCount
	});
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordPhpWasmArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPhpWasmArchiveIntegrationPaths);
	for(const update of record.implementationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpWasmArchiveSource);
		assert.equal(reverseDependentCheckedRecordPhpWasmArchiveImplementation(
			current, update), sourceAt(
			dependentCheckedRecordPhpWasmArchivePredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			dependentCheckedRecordPhpWasmArchivePredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpWasmArchiveSource);
		assert.equal(reverseDependentCheckedRecordPhpWasmArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordPhpWasmArchiveImplementation, update.path));
	}
	assert.deepEqual(record.additions.slice(0
		, dependentCheckedRecordPhpWasmArchiveFoundationAddedPaths.length)
		.map(item => item.path)
	, dependentCheckedRecordPhpWasmArchiveFoundationAddedPaths);
});

test("dependent PHP-Wasm archive history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpWasmArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.implementationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPhpWasmArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPhpWasmArchiveImplementation(
		current, update));
});

test("dependent PHP-Wasm archive writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-php-wasm-archive-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const env = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-php-wasm-archive-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
