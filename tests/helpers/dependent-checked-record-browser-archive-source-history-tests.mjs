/**
 * Authenticate the hosted npm/browser dependent checked-record archive.
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
	beforeDependentCheckedRecordBrowserArchiveSource
	, dependentCheckedRecordBrowserArchiveAddedFileCount
	, dependentCheckedRecordBrowserArchiveFileCount
	, dependentCheckedRecordBrowserArchiveHistoryPath
	, dependentCheckedRecordBrowserArchiveImplementation
	, dependentCheckedRecordBrowserArchiveImplementationPaths
	, dependentCheckedRecordBrowserArchiveIndexSha256
	, dependentCheckedRecordBrowserArchiveIndexedFileCount
	, dependentCheckedRecordBrowserArchiveIntegrationPaths
	, dependentCheckedRecordBrowserArchivePredecessor
	, dependentCheckedRecordBrowserArchiveRoot
	, reverseDependentCheckedRecordBrowserArchiveImplementation
	, reverseDependentCheckedRecordBrowserArchiveIntegration
} from "./dependent-checked-record-browser-archive-source-history.mjs";
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

test("dependent checked-record browser archive history closes the exact tree"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordBrowserArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-browser-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordBrowserArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordBrowserArchiveImplementation);
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordBrowserArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordBrowserArchiveIntegrationPaths);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordBrowserArchiveRoot
		, indexSha256: dependentCheckedRecordBrowserArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordBrowserArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordBrowserArchiveFileCount
		, addedFileCount: dependentCheckedRecordBrowserArchiveAddedFileCount
	});
	const archivePaths = names(["ls-tree", "-r", "--name-only"
		, dependentCheckedRecordBrowserArchiveImplementation, "--"
		, dependentCheckedRecordBrowserArchiveRoot]);
	assert.equal(archivePaths.length
		, dependentCheckedRecordBrowserArchiveFileCount);
	const indexBytes = sourceAt(
		dependentCheckedRecordBrowserArchiveImplementation
		, `${dependentCheckedRecordBrowserArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes)
		, dependentCheckedRecordBrowserArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, dependentCheckedRecordBrowserArchiveIndexedFileCount);
	assert.deepEqual(archivePaths, [
		`${dependentCheckedRecordBrowserArchiveRoot}/index.json`
		, ...index.files.map(entry =>
			`${dependentCheckedRecordBrowserArchiveRoot}/${entry.path}`)
	].sort());
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordBrowserArchiveSource);
		assert.equal(reverseDependentCheckedRecordBrowserArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordBrowserArchiveImplementation, update.path));
	}
	for(const update of record.implementationUpdates)
		assert.equal(reverseDependentCheckedRecordBrowserArchiveImplementation(
			sourceAt(dependentCheckedRecordBrowserArchiveImplementation, update.path)
			, update), sourceAt(
			dependentCheckedRecordBrowserArchivePredecessor, update.path));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	}
);

test("dependent checked-record browser archive history rejects alteration"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordBrowserArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordBrowserArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordBrowserArchiveIntegration(
		current, update));
	}
);

test("dependent browser archive history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-browser-archive-history-"
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
		"scripts/update-dependent-checked-record-browser-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
