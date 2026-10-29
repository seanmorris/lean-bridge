/**
 * Qualify focused HostNull hosted-input acquisition and selection history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullFocusedArchiveInputSource
	, hostNullFocusedArchiveInputHistoryAdditions
	, hostNullFocusedArchiveInputHistoryPath
	, hostNullFocusedArchiveInputImplementation
	, hostNullFocusedArchiveInputImplementationPaths
	, hostNullFocusedArchiveInputIntegrationPaths
	, hostNullFocusedArchiveInputNormalizationPaths
	, hostNullFocusedArchiveInputPredecessor
	, reverseHostNullFocusedArchiveInputUpdate
} from "./host-null-focused-archive-input-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullFocusedArchiveInputHistoryPath, "utf8"));

test("focused HostNull archive inputs record their exact parent", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "host-null-focused-archive-input-source-v1");
	assert.equal(value.predecessorCommit, hostNullFocusedArchiveInputPredecessor);
	assert.equal(value.implementationCommit
		, hostNullFocusedArchiveInputImplementation);
	assert.equal(git([
		"rev-parse", `${hostNullFocusedArchiveInputImplementation}^`
	]).trim(), hostNullFocusedArchiveInputPredecessor);
});

test("focused HostNull archive inputs reverse every source", async () => {
	const value = await record();
	assert.deepEqual(value.updates.map(update => update.path)
		, [...hostNullFocusedArchiveInputImplementationPaths]);
	for(const update of value.updates)
	{
		const current = git([
			"show", `${hostNullFocusedArchiveInputImplementation}:${update.path}`
		]);
		const previous = git([
			"show", `${hostNullFocusedArchiveInputPredecessor}:${update.path}`
		]);
		assert.equal(reverseHostNullFocusedArchiveInputUpdate(current, update)
			, previous, update.path);
	}
});

test("focused HostNull archive registration is exactly reversible", async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...hostNullFocusedArchiveInputIntegrationPaths]);
	for(const update of value.integrationUpdates)
	{
		const implementation = git([
			"show", `${hostNullFocusedArchiveInputImplementation}:${update.path}`
		]);
		assert.equal(reverseHostNullFocusedArchiveInputUpdate(
			await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256), update
		), implementation, update.path);
	}
});

test("focused HostNull archive inputs own no live source pins", async () => {
	const value = await record();
	assert.equal(value.refreshedPins, 0);
	assert.deepEqual(value.currentSourcePaths, []);
});

test("focused HostNull archive inputs authenticate history controls"
	, async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...hostNullFocusedArchiveInputHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${hostNullFocusedArchiveInputImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256))
			, addition.sha256, addition.path);
	}
	for(const path of [
		...hostNullFocusedArchiveInputImplementationPaths
		, ...hostNullFocusedArchiveInputIntegrationPaths
	]) assert.ok(hostNullFocusedArchiveInputNormalizationPaths.includes(path)
		, path);
	}
);

test("focused HostNull archive inputs normalize to their predecessor"
	, async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const previous = beforeHostNullFocusedArchiveInputSource(
			update.path, await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256)
			, update.previousSha256
		);
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}}
);
