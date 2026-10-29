/**
 * Authenticate the copy-free large-evidence transaction history.
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
	beforeLargeEvidenceTransactionSource
	, largeEvidenceTransactionHistoryAdditions
	, largeEvidenceTransactionHistoryPath
	, largeEvidenceTransactionImplementation
	, largeEvidenceTransactionImplementationAdditions
	, largeEvidenceTransactionImplementationPaths
	, largeEvidenceTransactionIntegrationPaths
	, largeEvidenceTransactionPredecessor
	, reverseLargeEvidenceTransactionUpdate
} from "./large-evidence-transaction-source-history.mjs";
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	largeEvidenceTransactionHistoryPath, "utf8"));

test("large evidence history records the exact transaction", async () => {
	const history = await record();
	assert.equal(history.schemaVersion, 1);
	assert.equal(history.milestone, "large-evidence-transaction-source-v1");
	assert.equal(history.predecessorCommit, largeEvidenceTransactionPredecessor);
	assert.equal(history.implementationCommit
		, largeEvidenceTransactionImplementation);
	assert.deepEqual(history.updates.map(item => item.path).sort()
		, [...largeEvidenceTransactionImplementationPaths].sort());
	assert.deepEqual(history.implementationAdditions.map(item => item.path)
		, largeEvidenceTransactionImplementationAdditions);
	assert.deepEqual(history.integrationUpdates.map(item => item.path)
		, largeEvidenceTransactionIntegrationPaths);
	assert.equal(history.optimizedArchivers, 2);
	assert.equal(history.transactionTests, 3);
	assert.deepEqual(history.currentSourcePaths, []);
});

test("large evidence history reverses every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			largeEvidenceTransactionImplementation, update.path), update), true
		, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${largeEvidenceTransactionImplementation}:${update.path}`]);
		assert.equal(reverseLargeEvidenceTransactionUpdate(current, update)
			, previous, update.path);
		assert.equal(beforeLargeEvidenceTransactionSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("large evidence history authenticates added sources", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(addition.sha256, sha256(git(["show"
			, `${largeEvidenceTransactionImplementation}:${addition.path}`]))
		, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, largeEvidenceTransactionHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("large evidence history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${largeEvidenceTransactionImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseLargeEvidenceTransactionUpdate(current, forged));
});

test("large evidence history writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-large-evidence-transaction-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /large-evidence-transaction-source-history-20261029\.json/u);
});
