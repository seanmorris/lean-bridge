/**
 * Authenticate the direct proof-erasure archive lane-identity repair.
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
	beforeDirectProofErasureArchiveLaneIdentityRepairSource
	, directProofErasureArchiveLaneIdentityRepairHistoryAdditions
	, directProofErasureArchiveLaneIdentityRepairHistoryPath
	, directProofErasureArchiveLaneIdentityRepairImplementation
	, directProofErasureArchiveLaneIdentityRepairImplementationPaths
	, directProofErasureArchiveLaneIdentityRepairIntegrationPaths
	, directProofErasureArchiveLaneIdentityRepairPredecessor
	, reverseDirectProofErasureArchiveLaneIdentityRepairUpdate
} from "./direct-proof-erasure-archive-lane-identity-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureArchiveLaneIdentityRepairHistoryPath, "utf8"));

test("archive lane-identity repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-archive-lane-identity-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureArchiveLaneIdentityRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureArchiveLaneIdentityRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureArchiveLaneIdentityRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureArchiveLaneIdentityRepairIntegrationPaths);
	assert.equal(history.canonicalLaneIdentity, true);
	assert.equal(history.hostedRunId, 41021643593);
});

test("archive lane-identity repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureArchiveLaneIdentityRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureArchiveLaneIdentityRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureArchiveLaneIdentityRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureArchiveLaneIdentityRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("archive lane-identity repair restores the canonical matrix object", () => {
	const helper = git(["show"
		, `${directProofErasureArchiveLaneIdentityRepairImplementation}:tests/helpers/direct-proof-erasure-hosted-archive.mjs`]);
	const archiver = git(["show"
		, `${directProofErasureArchiveLaneIdentityRepairImplementation}:scripts/archive-direct-proof-erasure-hosted.mjs`]);
	assert.match(helper, /directProofErasureHostedMatrixLane/u);
	assert.match(helper, /item\.key === lane\.key/u);
	assert.match(archiver, /directProofErasureHostedMatrixLane\(lane\)/u);
});

test("archive lane-identity repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureArchiveLaneIdentityRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("archive lane-identity repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureArchiveLaneIdentityRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureArchiveLaneIdentityRepairUpdate(current, forged));
});

test("archive lane-identity repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-archive-lane-identity-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-archive-lane-identity-repair-source-history-20261030\.json/u);
});
