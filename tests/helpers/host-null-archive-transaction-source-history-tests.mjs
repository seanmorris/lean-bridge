/**
 * Authenticate the atomic HostNull archive publication history.
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
import { beforeFinRefinementSource }
	from "./fin-refinement-source-history.mjs";
import {
	beforeHostNullArchiveTransactionSource
	, hostNullArchiveTransactionHistoryAdditions
	, hostNullArchiveTransactionHistoryPath
	, hostNullArchiveTransactionImplementation
	, hostNullArchiveTransactionImplementationPaths
	, hostNullArchiveTransactionIntegrationPaths
	, hostNullArchiveTransactionPredecessor
	, reverseHostNullArchiveTransactionUpdate
} from "./host-null-archive-transaction-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullArchiveTransactionHistoryPath, "utf8"
));

test("HostNull archive transaction history records the exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone, "host-null-archive-transaction-source-v1");
		assert.equal(value.predecessorCommit
			, hostNullArchiveTransactionPredecessor);
		assert.equal(value.implementationCommit
			, hostNullArchiveTransactionImplementation);
		assert.deepEqual(value.updates.map(update => update.path)
			, hostNullArchiveTransactionImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, hostNullArchiveTransactionIntegrationPaths);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, hostNullArchiveTransactionHistoryAdditions);
	}
);

test("HostNull archive transaction history reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullArchiveTransactionImplementation, update.path
		), update), true, update.path);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullArchiveTransactionImplementation}:${update.path}`]);
		assert.equal(reverseHostNullArchiveTransactionUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullArchiveTransactionSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("HostNull archive transaction history authenticates new controls"
	, async () => {
		for(const addition of (await record()).historyAdditions)
			assert.equal(sha256(await sourceAtFinHistoryMilestone(
				addition.path, addition.sha256)), addition.sha256, addition.path);
	}
);

test("HostNull archive transaction history rejects forged transitions"
	, async () => {
		const update = (await record()).updates[0];
		const current = git(["show"
			, `${hostNullArchiveTransactionImplementation}:${update.path}`]);
		for(const forged of [
			{ ...update, currentSha256: "0".repeat(64) }
			, { ...update, previousSha256: "0".repeat(64) }
			, { ...update, path: "unknown.mjs" }
			, { ...update, edits: [] }
		]) assert.throws(() =>
			reverseHostNullArchiveTransactionUpdate(current, forged));
	}
);

test("HostNull archive transaction history writer refuses another checkout"
	, () => {
		const copy = spawnSync(process.execPath, [
			"scripts/update-host-null-archive-transaction-source-history.mjs"
		], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
		assert.notEqual(copy.status, 0);
		assert.match(`${copy.stdout}${copy.stderr}`
			, /host-null-archive-transaction-source-history-20261029\.json/u);
	}
);
