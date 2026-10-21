/**
 * Authenticate the hosted Perl dependent checked-record archive milestone.
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
	beforeDependentCheckedRecordPerlArchiveSource
	, dependentCheckedRecordPerlArchiveAddedFileCount
	, dependentCheckedRecordPerlArchiveFileCount
	, dependentCheckedRecordPerlArchiveHistoryPath
	, dependentCheckedRecordPerlArchiveImplementation
	, dependentCheckedRecordPerlArchiveImplementationPaths
	, dependentCheckedRecordPerlArchiveIndexSha256
	, dependentCheckedRecordPerlArchiveIndexedFileCount
	, dependentCheckedRecordPerlArchiveIntegrationPaths
	, dependentCheckedRecordPerlArchivePredecessor
	, dependentCheckedRecordPerlArchiveRoot
	, reverseDependentCheckedRecordPerlArchiveImplementation
	, reverseDependentCheckedRecordPerlArchiveIntegration
} from "./dependent-checked-record-perl-archive-source-history.mjs";
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

test("dependent checked-record Perl archive history closes the exact tree"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPerlArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-perl-archive-source-v1");
	assert.equal(record.predecessorCommit
		, dependentCheckedRecordPerlArchivePredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordPerlArchiveImplementation);
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordPerlArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordPerlArchiveIntegrationPaths);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordPerlArchiveRoot
		, indexSha256: dependentCheckedRecordPerlArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordPerlArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordPerlArchiveFileCount
		, addedFileCount: dependentCheckedRecordPerlArchiveAddedFileCount
	});
	const archivePaths = names(["ls-tree", "-r", "--name-only"
		, dependentCheckedRecordPerlArchiveImplementation, "--"
		, dependentCheckedRecordPerlArchiveRoot]);
	assert.equal(archivePaths.length
		, dependentCheckedRecordPerlArchiveFileCount);
	const indexBytes = sourceAt(
		dependentCheckedRecordPerlArchiveImplementation
		, `${dependentCheckedRecordPerlArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes)
		, dependentCheckedRecordPerlArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, dependentCheckedRecordPerlArchiveIndexedFileCount);
	assert.deepEqual(archivePaths, [
		`${dependentCheckedRecordPerlArchiveRoot}/index.json`
		, ...index.files.map(entry =>
			`${dependentCheckedRecordPerlArchiveRoot}/${entry.path}`)
	].sort());
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordPerlArchiveSource);
		assert.equal(reverseDependentCheckedRecordPerlArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordPerlArchiveImplementation, update.path));
	}
	for(const update of record.implementationUpdates)
		assert.equal(reverseDependentCheckedRecordPerlArchiveImplementation(
			sourceAt(dependentCheckedRecordPerlArchiveImplementation, update.path)
			, update), sourceAt(
			dependentCheckedRecordPerlArchivePredecessor, update.path));
	for(const addition of record.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256
		)), addition.currentSha256, addition.path);
	}
);

test("dependent checked-record Perl archive history rejects alteration"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordPerlArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.integrationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordPerlArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordPerlArchiveIntegration(
		current, update));
	}
);

test("dependent Perl archive history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-perl-archive-history-"
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
		"scripts/update-dependent-checked-record-perl-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
