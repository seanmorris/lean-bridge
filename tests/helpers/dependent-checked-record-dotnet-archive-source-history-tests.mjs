/**
 * Authenticate the hosted .NET dependent checked-record archive milestone.
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
	beforeDependentCheckedRecordDotnetArchiveSource
	, dependentCheckedRecordDotnetArchiveAddedFileCount
	, dependentCheckedRecordDotnetArchiveFileCount
	, dependentCheckedRecordDotnetArchiveHistoryPath
	, dependentCheckedRecordDotnetArchiveImplementation
	, dependentCheckedRecordDotnetArchiveImplementationPaths
	, dependentCheckedRecordDotnetArchiveIndexSha256
	, dependentCheckedRecordDotnetArchiveIndexedFileCount
	, dependentCheckedRecordDotnetArchiveIntegrationPaths
	, dependentCheckedRecordDotnetArchivePredecessor
	, dependentCheckedRecordDotnetArchiveRoot
	, reverseDependentCheckedRecordDotnetArchiveImplementation
	, reverseDependentCheckedRecordDotnetArchiveIntegration
} from "./dependent-checked-record-dotnet-archive-source-history.mjs";
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

test("dependent checked-record Dotnet archive history closes the exact tree"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordDotnetArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-dotnet-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordDotnetArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordDotnetArchiveImplementation);
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordDotnetArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordDotnetArchiveIntegrationPaths);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordDotnetArchiveRoot
		, indexSha256: dependentCheckedRecordDotnetArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordDotnetArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordDotnetArchiveFileCount
		, addedFileCount: dependentCheckedRecordDotnetArchiveAddedFileCount
	});
	const archivePaths = names(["ls-tree", "-r", "--name-only"
		, dependentCheckedRecordDotnetArchiveImplementation, "--"
		, dependentCheckedRecordDotnetArchiveRoot]);
	assert.equal(archivePaths.length
		, dependentCheckedRecordDotnetArchiveFileCount);
	const indexBytes = sourceAt(
		dependentCheckedRecordDotnetArchiveImplementation
		, `${dependentCheckedRecordDotnetArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes)
		, dependentCheckedRecordDotnetArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, dependentCheckedRecordDotnetArchiveIndexedFileCount);
	assert.deepEqual(archivePaths, [
		`${dependentCheckedRecordDotnetArchiveRoot}/index.json`
		, ...index.files.map(entry =>
			`${dependentCheckedRecordDotnetArchiveRoot}/${entry.path}`)
	].sort());
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordDotnetArchiveSource);
		assert.equal(reverseDependentCheckedRecordDotnetArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordDotnetArchiveImplementation, update.path));
	}
	for(const update of record.implementationUpdates)
		assert.equal(reverseDependentCheckedRecordDotnetArchiveImplementation(
			sourceAt(dependentCheckedRecordDotnetArchiveImplementation, update.path)
			, update), sourceAt(
			dependentCheckedRecordDotnetArchivePredecessor, update.path));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	}
);

test("dependent checked-record Dotnet archive history rejects alteration"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordDotnetArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordDotnetArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordDotnetArchiveIntegration(
		current, update));
	}
);

test("dependent Dotnet archive history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-dotnet-archive-history-"
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
		"scripts/update-dependent-checked-record-dotnet-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
