/**
 * Authenticate the hosted native-PHP dependent checked-record archive history.
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
	beforeDependentCheckedRecordPhpArchiveSource
	, dependentCheckedRecordPhpArchiveAddedFileCount
	, dependentCheckedRecordPhpArchiveFileCount
	, dependentCheckedRecordPhpArchiveFoundationAddedPaths
	, dependentCheckedRecordPhpArchiveHistoryPath
	, dependentCheckedRecordPhpArchiveImplementation
	, dependentCheckedRecordPhpArchiveImplementationPaths
	, dependentCheckedRecordPhpArchiveIndexSha256
	, dependentCheckedRecordPhpArchiveIndexedFileCount
	, dependentCheckedRecordPhpArchiveIntegrationPaths
	, dependentCheckedRecordPhpArchivePredecessor
	, dependentCheckedRecordPhpArchiveRoot
	, reverseDependentCheckedRecordPhpArchiveImplementation
	, reverseDependentCheckedRecordPhpArchiveIntegration
} from "./dependent-checked-record-php-archive-source-history.mjs";

const sourceAt = (revision, path) => execFileSync("git", ["show"
	, `${revision}:${path}`], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });

test("dependent native-PHP archive history restores every source", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpArchiveHistoryPath, "utf8"));
	assert.equal(record.milestone
		, "dependent-checked-record-php-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPhpArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPhpArchiveImplementation);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordPhpArchiveRoot
		, indexSha256: dependentCheckedRecordPhpArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordPhpArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordPhpArchiveFileCount
		, addedFileCount: dependentCheckedRecordPhpArchiveAddedFileCount
	});
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordPhpArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPhpArchiveIntegrationPaths);
	for(const update of record.implementationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpArchiveSource);
		assert.equal(reverseDependentCheckedRecordPhpArchiveImplementation(
			current, update), sourceAt(
			dependentCheckedRecordPhpArchivePredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), sourceAt(
			dependentCheckedRecordPhpArchivePredecessor, update.path));
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPhpArchiveSource);
		assert.equal(reverseDependentCheckedRecordPhpArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordPhpArchiveImplementation, update.path));
	}
	assert.deepEqual(record.additions.slice(0
		, dependentCheckedRecordPhpArchiveFoundationAddedPaths.length)
		.map(item => item.path)
	, dependentCheckedRecordPhpArchiveFoundationAddedPaths);
});

test("dependent native-PHP archive history rejects alteration", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPhpArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.implementationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPhpArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPhpArchiveImplementation(
		current, update));
});

test("dependent native-PHP archive writer refuses unrelated checkouts", async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-php-archive-history-"));
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
		"scripts/update-dependent-checked-record-php-archive-source-history.mjs"
	)], { cwd: root, env, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
});
