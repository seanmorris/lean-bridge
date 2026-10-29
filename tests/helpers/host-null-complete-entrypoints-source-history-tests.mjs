/**
 * Authenticate the complete HostNull audit entry points and shared pins.
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
	beforeHostNullCompleteEntrypointsSource
	, hostNullCompleteEntrypointsHistoryAdditions
	, hostNullCompleteEntrypointsHistoryPath
	, hostNullCompleteEntrypointsImplementation
	, hostNullCompleteEntrypointsImplementationAdditions
	, hostNullCompleteEntrypointsImplementationPaths
	, hostNullCompleteEntrypointsIntegrationPaths
	, hostNullCompleteEntrypointsPredecessor
	, reverseHostNullCompleteEntrypointsUpdate
} from "./host-null-complete-entrypoints-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 64 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullCompleteEntrypointsHistoryPath, "utf8"));

test("HostNull completion entry points record their exact transaction"
	, async () => {
		const history = await record();
		assert.equal(history.schemaVersion, 1);
		assert.equal(history.milestone
			, "host-null-complete-entrypoints-source-v1");
		assert.equal(history.predecessorCommit
			, hostNullCompleteEntrypointsPredecessor);
		assert.equal(history.implementationCommit
			, hostNullCompleteEntrypointsImplementation);
		assert.deepEqual(history.updates.map(item => item.path)
			, hostNullCompleteEntrypointsImplementationPaths);
		assert.deepEqual(history.implementationAdditions.map(item => item.path)
			, hostNullCompleteEntrypointsImplementationAdditions);
		assert.deepEqual(history.integrationUpdates.map(item => item.path)
			, hostNullCompleteEntrypointsIntegrationPaths);
		assert.equal(history.auditEntrypoints, 2);
		assert.equal(history.hostedLanes, 7);
		assert.equal(history.cells, 170);
		assert.deepEqual(history.currentSourcePaths, []);
	}
);

test("HostNull completion entry points reverse every source", async () => {
	const history = await record();
	for(const update of history.updates)
		assert.equal(await authenticateSourceHistoryReverse(gitSourceBytes(
			hostNullCompleteEntrypointsImplementation, update.path
		), update), true, update.path);
	for(const update of history.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show"
			, `${hostNullCompleteEntrypointsImplementation}:${update.path}`]);
		assert.equal(reverseHostNullCompleteEntrypointsUpdate(
			current, update), previous, update.path);
		assert.equal(beforeHostNullCompleteEntrypointsSource(
			update.path, current, update.previousSha256), previous, update.path);
	}
});

test("HostNull completion entry points share one exact source list", () => {
	const promotion = git(["show"
		, `${hostNullCompleteEntrypointsImplementation}:tests/helpers/host-null-complete-promotion.mjs`]);
	const tests = git(["show"
		, `${hostNullCompleteEntrypointsImplementation}:tests/helpers/host-null-complete-promotion-tests.mjs`]);
	assert.match(promotion, /export const hostNullCompletePromotionReferencePaths/u);
	assert.match(tests, /hostNullCompletePromotionReferencePaths/u);
	for(const path of hostNullCompleteEntrypointsImplementationAdditions)
	{
		assert.ok(promotion.includes(path), path);
		assert.match(git(["show"
			, `${hostNullCompleteEntrypointsImplementation}:${path}`])
			, /node:test/u, path);
	}
});

test("HostNull entry-point history authenticates additions", async () => {
	const history = await record();
	for(const addition of history.implementationAdditions)
		assert.equal(addition.sha256, sha256(git(["show"
			, `${hostNullCompleteEntrypointsImplementation}:${addition.path}`]))
		, addition.path);
	assert.deepEqual(history.historyAdditions.map(item => item.path)
		, hostNullCompleteEntrypointsHistoryAdditions);
	for(const addition of history.historyAdditions)
	{
		const source = await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("HostNull entry-point history rejects forged transitions", async () => {
	const update = (await record()).updates[0];
	const current = git(["show"
		, `${hostNullCompleteEntrypointsImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unknown.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() =>
		reverseHostNullCompleteEntrypointsUpdate(current, forged));
});

test("HostNull entry-point history writer refuses another checkout", () => {
	const directory = new URL("../../", import.meta.url);
	const copy = spawnSync(process.execPath, [
		"scripts/update-host-null-complete-entrypoints-source-history.mjs"
	], { cwd: directory, encoding: "utf8" });
	assert.notEqual(copy.status, 0);
	assert.match(`${copy.stdout}${copy.stderr}`
		, /host-null-complete-entrypoints-source-history-20261029\.json/u);
});
