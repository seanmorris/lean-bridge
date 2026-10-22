/**
 * Authenticate the hosted C/C++ dependent checked-record archive milestone.
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
	beforeDependentCheckedRecordNativeArchiveSource
	, dependentCheckedRecordNativeArchiveAddedFileCount
	, dependentCheckedRecordNativeArchiveFileCount
	, dependentCheckedRecordNativeArchiveHistoryPath
	, dependentCheckedRecordNativeArchiveImplementation
	, dependentCheckedRecordNativeArchiveImplementationPaths
	, dependentCheckedRecordNativeArchiveIndexSha256
	, dependentCheckedRecordNativeArchiveIndexedFileCount
	, dependentCheckedRecordNativeArchiveIntegrationPaths
	, dependentCheckedRecordNativeArchivePredecessor
	, dependentCheckedRecordNativeArchiveRoot
	, reverseDependentCheckedRecordNativeArchiveImplementation
	, reverseDependentCheckedRecordNativeArchiveIntegration
} from "./dependent-checked-record-native-archive-source-history.mjs";
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

test("dependent checked-record Native archive history closes the exact tree"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordNativeArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-native-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordNativeArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordNativeArchiveImplementation);
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordNativeArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordNativeArchiveIntegrationPaths);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordNativeArchiveRoot
		, indexSha256: dependentCheckedRecordNativeArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordNativeArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordNativeArchiveFileCount
		, addedFileCount: dependentCheckedRecordNativeArchiveAddedFileCount
	});
	const archivePaths = names(["ls-tree", "-r", "--name-only"
		, dependentCheckedRecordNativeArchiveImplementation, "--"
		, dependentCheckedRecordNativeArchiveRoot]);
	assert.equal(archivePaths.length
		, dependentCheckedRecordNativeArchiveFileCount);
	const indexBytes = sourceAt(
		dependentCheckedRecordNativeArchiveImplementation
		, `${dependentCheckedRecordNativeArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes)
		, dependentCheckedRecordNativeArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, dependentCheckedRecordNativeArchiveIndexedFileCount);
	assert.deepEqual(archivePaths, [
		`${dependentCheckedRecordNativeArchiveRoot}/index.json`
		, ...index.files.map(entry =>
			`${dependentCheckedRecordNativeArchiveRoot}/${entry.path}`)
	].sort());
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordNativeArchiveSource);
		assert.equal(reverseDependentCheckedRecordNativeArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordNativeArchiveImplementation, update.path));
	}
	for(const update of record.implementationUpdates)
		assert.equal(reverseDependentCheckedRecordNativeArchiveImplementation(
			sourceAt(dependentCheckedRecordNativeArchiveImplementation, update.path)
			, update), sourceAt(
			dependentCheckedRecordNativeArchivePredecessor, update.path));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	}
);

test("dependent checked-record Native archive history rejects alteration"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordNativeArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordNativeArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordNativeArchiveIntegration(
		current, update));
	}
);

test("dependent Native archive history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-native-archive-history-"
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
		"scripts/update-dependent-checked-record-native-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
