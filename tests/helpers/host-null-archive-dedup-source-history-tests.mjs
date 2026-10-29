/**
 * Authenticate the HostNull archive deduplication source history.
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
	beforeHostNullArchiveDedupSource, hostNullArchiveDedupHistoryAdditions
	, hostNullArchiveDedupHistoryPath, hostNullArchiveDedupImplementation
	, hostNullArchiveDedupImplementationPaths
	, hostNullArchiveDedupIntegrationPaths, hostNullArchiveDedupPredecessor
	, reverseHostNullArchiveDedupUpdate
} from "./host-null-archive-dedup-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 256 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullArchiveDedupHistoryPath, "utf8"
));

test("HostNull archive dedup history records the exact implementation"
	, async () => {
		const value = await record();
		assert.equal(value.schemaVersion, 1);
		assert.equal(value.milestone, "host-null-archive-dedup-source-v1");
		assert.equal(value.predecessorCommit, hostNullArchiveDedupPredecessor);
		assert.equal(value.implementationCommit, hostNullArchiveDedupImplementation);
		assert.deepEqual(value.updates.map(update => update.path)
			, hostNullArchiveDedupImplementationPaths);
		assert.deepEqual(value.integrationUpdates.map(update => update.path)
			, hostNullArchiveDedupIntegrationPaths);
		assert.deepEqual(value.historyAdditions.map(item => item.path)
			, hostNullArchiveDedupHistoryAdditions);
	}
);

test("HostNull archive dedup history reverses every source", async () => {
	const value = await record();
	for(const update of value.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullArchiveDedupImplementation, update.path
		), update), true, update.path);
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullArchiveDedupImplementation}:${update.path}`]);
		assert.equal(reverseHostNullArchiveDedupUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullArchiveDedupSource(
			update.path, current, update.previousSha256), previous, update.path);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("HostNull archive dedup history authenticates new controls", async () => {
	for(const addition of (await record()).historyAdditions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256)), addition.sha256, addition.path);
});

test("HostNull archive dedup history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${hostNullArchiveDedupImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseHostNullArchiveDedupUpdate(current, forged));
});

test("HostNull archive dedup history writer refuses another checkout", () => {
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-archive-dedup-source-history.mjs"
	], { cwd: new URL("../../", import.meta.url), encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-archive-dedup-source-history-20261029\.json/u);
});
