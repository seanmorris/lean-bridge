/**
 * Authenticate the hosted WIT dependent checked-record archive milestone.
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
	beforeDependentCheckedRecordWitArchiveSource
	, dependentCheckedRecordWitArchiveCommit
	, dependentCheckedRecordWitArchiveCompletedPaths
	, dependentCheckedRecordWitArchiveCompletionCommit
	, dependentCheckedRecordWitArchiveCompletionPredecessor
	, dependentCheckedRecordWitArchiveFileCount
	, dependentCheckedRecordWitArchiveFoundationAddedPaths
	, dependentCheckedRecordWitArchiveHistoryPath
	, dependentCheckedRecordWitArchiveImplementation
	, dependentCheckedRecordWitArchiveImplementationPaths
	, dependentCheckedRecordWitArchiveIndexSha256
	, dependentCheckedRecordWitArchiveInitialFileCount
	, dependentCheckedRecordWitArchiveIndexedFileCount
	, dependentCheckedRecordWitArchiveIntegrationPaths
	, dependentCheckedRecordWitArchivePredecessor
	, dependentCheckedRecordWitArchiveRoot
	, dependentCheckedRecordWitArchiveVerifierPredecessor
	, reverseDependentCheckedRecordWitArchiveImplementation
	, reverseDependentCheckedRecordWitArchiveIntegration
} from "./dependent-checked-record-wit-archive-source-history.mjs";
import { beforeFinRefinementSource } from "./fin-refinement-source-history.mjs";
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

test("dependent checked-record WIT archive history closes the exact tree"
	, async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitArchiveHistoryPath, "utf8"));
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone
		, "dependent-checked-record-wit-archive-source-v1");
	assert.equal(record.archivePredecessorCommit
		, dependentCheckedRecordWitArchivePredecessor);
	assert.equal(record.archiveCommit
		, dependentCheckedRecordWitArchiveCommit);
	assert.equal(record.archiveCompletionPredecessorCommit
		, dependentCheckedRecordWitArchiveCompletionPredecessor);
	assert.equal(record.archiveCompletionCommit
		, dependentCheckedRecordWitArchiveCompletionCommit);
	assert.equal(record.verifierPredecessorCommit
		, dependentCheckedRecordWitArchiveVerifierPredecessor);
	assert.equal(record.implementationCommit
		, dependentCheckedRecordWitArchiveImplementation);
	assert.deepEqual(record.implementationUpdates.map(item => item.path)
		, dependentCheckedRecordWitArchiveImplementationPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path)
		, dependentCheckedRecordWitArchiveIntegrationPaths);
	assert.deepEqual(record.archive, {
		root: dependentCheckedRecordWitArchiveRoot
		, indexSha256: dependentCheckedRecordWitArchiveIndexSha256
		, indexedFileCount: dependentCheckedRecordWitArchiveIndexedFileCount
		, archiveFileCount: dependentCheckedRecordWitArchiveFileCount
		, initialArchiveFileCount:
			dependentCheckedRecordWitArchiveInitialFileCount
		, completedPaths: dependentCheckedRecordWitArchiveCompletedPaths
	});
	const archivePaths = names(["ls-tree", "-r", "--name-only"
		, dependentCheckedRecordWitArchiveCompletionCommit, "--"
		, dependentCheckedRecordWitArchiveRoot]);
	assert.equal(archivePaths.length
		, dependentCheckedRecordWitArchiveFileCount);
	const indexBytes = sourceAt(dependentCheckedRecordWitArchiveCompletionCommit
		, `${dependentCheckedRecordWitArchiveRoot}/index.json`);
	assert.equal(sha256(indexBytes)
		, dependentCheckedRecordWitArchiveIndexSha256);
	const index = JSON.parse(indexBytes);
	assert.equal(index.files.length
		, dependentCheckedRecordWitArchiveIndexedFileCount);
	assert.deepEqual(archivePaths, [
		`${dependentCheckedRecordWitArchiveRoot}/index.json`
		, ...index.files.map(entry =>
			`${dependentCheckedRecordWitArchiveRoot}/${entry.path}`)
	].sort());
	for(const update of record.implementationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitArchiveSource);
		const previous = reverseDependentCheckedRecordWitArchiveImplementation(
			current, update);
		assert.equal(previous, sourceAt(
			dependentCheckedRecordWitArchiveVerifierPredecessor, update.path));
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256
			, beforeDependentCheckedRecordWitArchiveSource);
		assert.equal(reverseDependentCheckedRecordWitArchiveIntegration(
			current, update), sourceAt(
			dependentCheckedRecordWitArchiveCompletionCommit, update.path));
	}
	const additionPaths = record.additions.map(item => item.path);
	for(const path of dependentCheckedRecordWitArchiveFoundationAddedPaths)
		assert.ok(additionPaths.includes(path));
	for(const addition of record.additions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256);
		assert.equal(sha256(source), addition.currentSha256, addition.path);
	}
	}
);

test("dependent WIT archive history rejects altered transitions", async () => {
	const record = JSON.parse(await readFile(
		dependentCheckedRecordWitArchiveHistoryPath, "utf8"));
	const update = structuredClone(record.implementationUpdates[0]);
	const current = await sourceAtFinHistoryMilestone(
		update.path, update.currentSha256
		, beforeDependentCheckedRecordWitArchiveSource);
	update.currentSha256 = "0".repeat(64);
	assert.throws(() => reverseDependentCheckedRecordWitArchiveImplementation(
		current, update));
	update.currentSha256 = sha256(current);
	update.path = "src/not-recorded.mjs";
	assert.throws(() => reverseDependentCheckedRecordWitArchiveImplementation(
		current, update));
});

test("dependent WIT archive history writer refuses unrelated checkouts"
	, async t => {
	const root = await mkdtemp(join(
		tmpdir(), "lean-dependent-wit-archive-history-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const environment = Object.fromEntries(Object.entries(process.env)
		.filter(([key]) => !key.startsWith("GIT_")));
	const git = arguments_ => execFileSync("git", arguments_, {
		cwd: root, env: environment, stdio: "pipe"
	});
	git(["init", "--quiet"]);
	git(["-c", "user.name=Test", "-c", "user.email=test@example.invalid"
		, "-c", "commit.gpgsign=false", "commit", "--allow-empty"
		, "--quiet", "-m", "unrelated"]);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-dependent-checked-record-wit-archive-source-history.mjs"
	)], { cwd: root, env: environment, encoding: "utf8" });
	assert.equal(result.status, 1);
	assert.match(result.stderr, /implementation commit/u);
	assert.deepEqual(await readdir(root), [".git"]);
	}
);
