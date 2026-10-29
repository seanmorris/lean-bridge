/**
 * Authenticate the focused dependent-signature archive source history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	authenticateSourceHistoryReverse, gitSourceBytes
} from "./source-history-stream.mjs";
import {
	beforeDependentSignatureFocusedArchiveSource
	, dependentSignatureFocusedArchiveChangedPaths
	, dependentSignatureFocusedArchiveCommits
	, dependentSignatureFocusedArchiveHistoryAdditions
	, dependentSignatureFocusedArchiveHistoryPath
	, dependentSignatureFocusedArchiveImplementation
	, dependentSignatureFocusedArchiveImplementationAdditions
	, dependentSignatureFocusedArchiveIntegrationPaths
	, dependentSignatureFocusedArchivePredecessor
	, reverseDependentSignatureFocusedArchiveUpdate
} from "./dependent-signature-focused-archive-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentSignatureFocusedArchiveHistoryPath, "utf8"));

test("focused dependent-signature archive records its exact transaction"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "dependent-signature-focused-archive-source-v1");
		assert.equal(history.predecessorCommit
			, dependentSignatureFocusedArchivePredecessor);
		assert.equal(history.implementationCommit
			, dependentSignatureFocusedArchiveImplementation);
		assert.deepEqual(history.commits.map(item => item.commit)
			, dependentSignatureFocusedArchiveCommits);
		assert.deepEqual([...new Set(history.updates.map(item => item.path))].sort()
			, [...dependentSignatureFocusedArchiveChangedPaths].sort());
		assert.deepEqual(history.implementationAdditions.map(item => item.path)
			, dependentSignatureFocusedArchiveImplementationAdditions);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, dependentSignatureFocusedArchiveIntegrationPaths);
		assert.equal(history.producerArtifacts, 11);
		assert.equal(history.receiptArtifacts, 1);
		assert.equal(history.reports, 44);
		assert.equal(history.profiles, 17);
		assert.equal(history.cells, 34);
		assert.deepEqual(history.currentSourcePaths, []);
	}
);

test("focused dependent-signature archive reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			update.commit, update.path), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${dependentSignatureFocusedArchiveImplementation}:${update.path}`]);
		assert.equal(reverseDependentSignatureFocusedArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDependentSignatureFocusedArchiveSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("focused archive binds the successful same-run topology", () => {
	const source = git(["show"
		, `${dependentSignatureFocusedArchiveImplementation}:tests/helpers/dependent-signature-hosted-archive.mjs`]);
	assert.match(source, /40927405318/u);
	assert.match(source, /7f206cdbf35d650c48917572e6344fdc0194aeb7/u);
	assert.match(source, /dependent-signature-matrix/u);
	assert.match(source, /dependentSignatureMatrixLanes\.map/u);
	const downloader = git(["show"
		, `${dependentSignatureFocusedArchiveImplementation}:scripts/download-dependent-signature-hosted-inputs.mjs`]);
	assert.match(downloader, /filter=all&/u);
	assert.match(downloader, /job\.run_attempt === run\.run_attempt/u);
});

test("focused archive history authenticates additions", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(addition.sha256, sha256(git(["show"
			, `${dependentSignatureFocusedArchiveImplementation}:${addition.path}`]))
		, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, dependentSignatureFocusedArchiveHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("focused archive history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show", `${update.commit}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDependentSignatureFocusedArchiveUpdate(current, forged));
});

test("focused archive history writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-dependent-signature-focused-archive-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /dependent-signature-focused-archive-source-history-20261029\.json/u);
});
