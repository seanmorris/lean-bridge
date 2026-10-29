/**
 * Qualify the bounded HostNull producer and exact-run receipt history.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeHostNullFocusedCiSource, hostNullFocusedCiHistoryAdditions
	, hostNullFocusedCiHistoryPath, hostNullFocusedCiImplementation
	, hostNullFocusedCiImplementationAdditions
	, hostNullFocusedCiImplementationPaths
	, hostNullFocusedCiIntegrationPaths
	, hostNullFocusedCiNormalizationPaths, hostNullFocusedCiPredecessor
	, reverseHostNullFocusedCiUpdate
} from "./host-null-focused-ci-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	hostNullFocusedCiHistoryPath, "utf8"));

test("focused HostNull CI records its exact implementation parent", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "host-null-focused-ci-source-v1");
	assert.equal(value.predecessorCommit, hostNullFocusedCiPredecessor);
	assert.equal(value.implementationCommit, hostNullFocusedCiImplementation);
	assert.equal(git(["rev-parse", `${hostNullFocusedCiImplementation}^`]).trim()
		, hostNullFocusedCiPredecessor);
});

test("focused HostNull CI reverses every implementation source", async () => {
	const value = await record();
	assert.deepEqual(value.updates.map(update => update.path)
		, [...hostNullFocusedCiImplementationPaths]);
	for(const update of value.updates)
	{
		const current = git([
			"show", `${hostNullFocusedCiImplementation}:${update.path}`
		]);
		const previous = git([
			"show", `${hostNullFocusedCiPredecessor}:${update.path}`
		]);
		assert.equal(reverseHostNullFocusedCiUpdate(current, update)
			, previous, update.path);
	}
});

test("focused HostNull CI authenticates new receipt controls", async () => {
	const value = await record();
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, [...hostNullFocusedCiImplementationAdditions]);
	for(const addition of value.implementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${hostNullFocusedCiPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${hostNullFocusedCiImplementation}:${addition.path}`]))
			, addition.sha256, addition.path);
	}
});

test("focused HostNull CI registration is exactly reversible", async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...hostNullFocusedCiIntegrationPaths]);
	for(const update of value.integrationUpdates)
	{
		const live = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const implementation = git([
			"show", `${hostNullFocusedCiImplementation}:${update.path}`
		]);
		assert.equal(reverseHostNullFocusedCiUpdate(live, update)
			, implementation, update.path);
	}
});

test("focused HostNull CI owns no promoted type-surface source pins"
	, async () => {
	const value = await record();
	assert.equal(value.refreshedPins, 0);
	assert.deepEqual(value.currentSourcePaths, []);
		assert.deepEqual(value.currentSourceDigests, []);}
);

test("focused HostNull CI authenticates every history control", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...hostNullFocusedCiHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${hostNullFocusedCiImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.sha256))
			, addition.sha256, addition.path);
	}
	for(const path of [
		...hostNullFocusedCiImplementationPaths
		, ...hostNullFocusedCiIntegrationPaths
	]) assert.ok(hostNullFocusedCiNormalizationPaths.includes(path), path);
});

test("focused HostNull CI normalizes current sources to its predecessor"
	, async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const previous = beforeHostNullFocusedCiSource(
			update.path, await sourceAtFinHistoryMilestone(
				update.path, update.currentSha256)
			, update.previousSha256
		);
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}}
);
