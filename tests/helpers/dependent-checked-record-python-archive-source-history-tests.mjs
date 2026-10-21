/**
 * Authenticate the hosted Python dependent checked-record archive milestone.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeDependentCheckedRecordPythonArchiveSource
	, dependentCheckedRecordPythonArchiveAddedFileCount
	, dependentCheckedRecordPythonArchiveFileCount
	, dependentCheckedRecordPythonArchiveHistoryPath
	, dependentCheckedRecordPythonArchiveImplementation
	, dependentCheckedRecordPythonArchiveImplementationPaths
	, dependentCheckedRecordPythonArchiveIndexSha256
	, dependentCheckedRecordPythonArchiveIndexedFileCount
	, dependentCheckedRecordPythonArchiveIntegrationPaths
	, dependentCheckedRecordPythonArchivePredecessor
	, dependentCheckedRecordPythonArchiveRoot
	, reverseDependentCheckedRecordPythonArchiveImplementation
	, reverseDependentCheckedRecordPythonArchiveIntegration
} from "./dependent-checked-record-python-archive-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import {
	sourceAtFinHistoryMilestone
} from "./source-at-fin-history-milestone.mjs";

const sourceAt = (revision, path) => execFileSync("git"
	, ["show", `${revision}:${path}`]
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
}).trim().split("\n").filter(Boolean).sort();

test("dependent checked-record Python archive history closes the exact tree"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPythonArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-python-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPythonArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPythonArchiveImplementation);
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordPythonArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPythonArchiveIntegrationPaths);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordPythonArchiveRoot
		, indexSha256: dependentCheckedRecordPythonArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordPythonArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordPythonArchiveFileCount
		, addedFileCount: dependentCheckedRecordPythonArchiveAddedFileCount
	});
	const archivePaths = names(["ls-tree", "-r", "--name-only"
		, dependentCheckedRecordPythonArchiveImplementation, "--"
		, dependentCheckedRecordPythonArchiveRoot]);
	assert.equal(archivePaths.length
		, dependentCheckedRecordPythonArchiveFileCount);
	const indexBytes = sourceAt(
		dependentCheckedRecordPythonArchiveImplementation
		, `${dependentCheckedRecordPythonArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes)
		, dependentCheckedRecordPythonArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, dependentCheckedRecordPythonArchiveIndexedFileCount);
	assert.deepEqual(archivePaths, [
		`${dependentCheckedRecordPythonArchiveRoot}/index.json`
		, ...index.files.map(entry =>
			`${dependentCheckedRecordPythonArchiveRoot}/${entry.path}`)
	].sort());
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPythonArchiveSource);
		assert.equal(reverseDependentCheckedRecordPythonArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordPythonArchiveImplementation, update.path));
	}
	for(const update of record.implementationUpdates)
		assert.equal(reverseDependentCheckedRecordPythonArchiveImplementation(
			sourceAt(dependentCheckedRecordPythonArchiveImplementation, update.path)
			, update), sourceAt(
			dependentCheckedRecordPythonArchivePredecessor, update.path));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	}
);

test("dependent checked-record Python archive history rejects alteration"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPythonArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPythonArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPythonArchiveIntegration(
		current, update));
	}
);

test("dependent Python archive history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-python-archive-history-"
	));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_
		, { cwd: root, env: environment, stdio: "pipe" });
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-python-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
