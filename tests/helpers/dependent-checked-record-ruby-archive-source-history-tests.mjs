/**
 * Authenticate the hosted Ruby dependent checked-record archive milestone.
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
	beforeDependentCheckedRecordRubyArchiveSource
	, dependentCheckedRecordRubyArchiveAddedFileCount
	, dependentCheckedRecordRubyArchiveFileCount
	, dependentCheckedRecordRubyArchiveHistoryPath
	, dependentCheckedRecordRubyArchiveImplementation
	, dependentCheckedRecordRubyArchiveImplementationPaths
	, dependentCheckedRecordRubyArchiveIndexSha256
	, dependentCheckedRecordRubyArchiveIndexedFileCount
	, dependentCheckedRecordRubyArchiveIntegrationPaths
	, dependentCheckedRecordRubyArchivePredecessor
	, dependentCheckedRecordRubyArchiveRoot
	, reverseDependentCheckedRecordRubyArchiveImplementation
	, reverseDependentCheckedRecordRubyArchiveIntegration
} from "./dependent-checked-record-ruby-archive-source-history.mjs";
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

test("dependent checked-record Ruby archive history closes the exact tree"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordRubyArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-ruby-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordRubyArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordRubyArchiveImplementation);
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordRubyArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordRubyArchiveIntegrationPaths);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordRubyArchiveRoot
		, indexSha256: dependentCheckedRecordRubyArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordRubyArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordRubyArchiveFileCount
		, addedFileCount: dependentCheckedRecordRubyArchiveAddedFileCount
	});
	const archivePaths = names(["ls-tree", "-r", "--name-only"
		, dependentCheckedRecordRubyArchiveImplementation, "--"
		, dependentCheckedRecordRubyArchiveRoot]);
	assert.equal(archivePaths.length
		, dependentCheckedRecordRubyArchiveFileCount);
	const indexBytes = sourceAt(
		dependentCheckedRecordRubyArchiveImplementation
		, `${dependentCheckedRecordRubyArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes)
		, dependentCheckedRecordRubyArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, dependentCheckedRecordRubyArchiveIndexedFileCount);
	assert.deepEqual(archivePaths, [
		`${dependentCheckedRecordRubyArchiveRoot}/index.json`
		, ...index.files.map(entry =>
			`${dependentCheckedRecordRubyArchiveRoot}/${entry.path}`)
	].sort());
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordRubyArchiveSource);
		assert.equal(reverseDependentCheckedRecordRubyArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordRubyArchiveImplementation, update.path));
	}
	for(const update of record.implementationUpdates)
		assert.equal(reverseDependentCheckedRecordRubyArchiveImplementation(
			sourceAt(dependentCheckedRecordRubyArchiveImplementation, update.path)
			, update), sourceAt(
			dependentCheckedRecordRubyArchivePredecessor, update.path));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	}
);

test("dependent checked-record Ruby archive history rejects alteration"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordRubyArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordRubyArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordRubyArchiveIntegration(
		current, update));
	}
);

test("dependent Ruby archive history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-ruby-archive-history-"
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
		"scripts/update-dependent-checked-record-ruby-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
		assert.deepEqual(await readdir(root), [".git"]);}
);
