/**
 * Authenticate the direct proof-erasure managed receipt-profile repair.
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
	beforeDirectProofErasureReceiptProfileRepairSource
	, directProofErasureReceiptProfileRepairHistoryAdditions
	, directProofErasureReceiptProfileRepairHistoryPath
	, directProofErasureReceiptProfileRepairImplementation
	, directProofErasureReceiptProfileRepairImplementationPaths
	, directProofErasureReceiptProfileRepairIntegrationPaths
	, directProofErasureReceiptProfileRepairPredecessor
	, reverseDirectProofErasureReceiptProfileRepairUpdate
} from "./direct-proof-erasure-receipt-profile-repair-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureReceiptProfileRepairHistoryPath, "utf8"));

test("managed receipt-profile repair records its exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone
		, "direct-proof-erasure-receipt-profile-repair-source-v1");
	assert.equal(history.predecessorCommit
		, directProofErasureReceiptProfileRepairPredecessor);
	assert.equal(history.implementationCommit
		, directProofErasureReceiptProfileRepairImplementation);
	assert.deepEqual(history.updates.map(item => item.path)
		, directProofErasureReceiptProfileRepairImplementationPaths);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, directProofErasureReceiptProfileRepairIntegrationPaths);
	assert.equal(history.hostedRunId, 41011134514);
	assert.equal(history.failedJobId, 123944202063);
	assert.equal(history.managedProfilesAuthenticated, true);
});

test("managed receipt-profile repair reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			directProofErasureReceiptProfileRepairImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${directProofErasureReceiptProfileRepairImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureReceiptProfileRepairUpdate(
			current, update), previous, update.path);
		assert.equal(beforeDirectProofErasureReceiptProfileRepairSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("managed receipt-profile repair binds group and closed profiles", () => {
	const receipt = git(["show"
		, `${directProofErasureReceiptProfileRepairImplementation}:tests/helpers/direct-proof-erasure-matrix-receipt.mjs`]);
	const tests = git(["show"
		, `${directProofErasureReceiptProfileRepairImplementation}:tests/helpers/direct-proof-erasure-matrix-receipt-tests.mjs`]);
	assert.match(receipt, /group: lane\.group, profiles: \[\.\.\.lane\.profiles\]/u);
	assert.match(tests, /value => \{ value\.profiles\.pop\(\); \}/u);
	assert.match(tests, /value => \{ delete value\.profiles; \}/u);
});

test("managed receipt-profile repair authenticates history controls", async () => {
	const history = await record();
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, directProofErasureReceiptProfileRepairHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("managed receipt-profile repair rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${directProofErasureReceiptProfileRepairImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseDirectProofErasureReceiptProfileRepairUpdate(current, forged));
});

test("managed receipt-profile repair writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-direct-proof-erasure-receipt-profile-repair-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /direct-proof-erasure-receipt-profile-repair-source-history-20261030\.json/u);
});
