/**
 * Authenticate the focused direct proof-erasure archive source history.
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
	beforeDirectProofErasureFocusedArchiveSource
	, directProofErasureFocusedArchiveChangedPaths
	, directProofErasureFocusedArchiveHistoryAdditions
	, directProofErasureFocusedArchiveHistoryPath
	, directProofErasureFocusedArchiveImplementation
	, directProofErasureFocusedArchiveIntegrationPaths
	, directProofErasureFocusedArchivePredecessor
	, reverseDirectProofErasureFocusedArchiveUpdate
} from "./direct-proof-erasure-focused-archive-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureFocusedArchiveHistoryPath, "utf8"));

test("focused proof-erasure archive records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-focused-archive-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureFocusedArchivePredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureFocusedArchiveImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureFocusedArchiveChangedPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureFocusedArchiveIntegrationPaths);
	assert.deepEqual(history.implementationAdditions, []);
	assert.equal(history.producerArtifacts, 10);
	assert.equal(history.receiptArtifacts, 1);
	assert.equal(history.reports, 20);
	assert.equal(history.profiles, 17);
	assert.equal(history.cells, 204);
});

test("focused proof-erasure archive reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureFocusedArchiveImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureFocusedArchiveImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureFocusedArchiveUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureFocusedArchiveSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("focused proof-erasure archive binds the successful run topology", () => {
	const archive = git(["show"
		, `${directProofErasureFocusedArchiveImplementation}:tests/helpers/direct-proof-erasure-hosted-archive.mjs`]);
	assert.match(archive, /41021643593/u);
	assert.match(archive, /09ca211fec5fcebfd47747cd55485781adf93974/u);
	assert.match(archive, /directProofErasureHostedReceipt = Object\.freeze/u);
	const downloader = git(["show"
		, `${directProofErasureFocusedArchiveImplementation}:scripts/download-direct-proof-erasure-hosted-inputs.mjs`]);
	assert.match(downloader, /filter=all&/u);
	assert.match(downloader
		, /job\.run_attempt === hostedRun\.value\.run_attempt/u);
});

test("focused proof-erasure archive authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureFocusedArchiveHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("focused proof-erasure archive rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureFocusedArchiveImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureFocusedArchiveUpdate(current, forged));
});

test("focused proof-erasure archive writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-focused-archive-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-focused-archive-source-history-20261030\.json/u);
});
