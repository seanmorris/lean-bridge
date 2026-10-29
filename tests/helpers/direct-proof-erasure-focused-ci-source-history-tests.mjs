/**
 * Qualify the bounded direct proof-erasure producer and exact-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { beforeDependentSignatureFocusedCiSource }
	from "./dependent-signature-focused-ci-source-history.mjs";
import {
	beforeDirectProofErasureFocusedCiSource
	, directProofErasureFocusedCiHistoryAdditions
	, directProofErasureFocusedCiHistoryPath
	, directProofErasureFocusedCiImplementation
	, directProofErasureFocusedCiImplementationAdditions
	, directProofErasureFocusedCiImplementationPaths
	, directProofErasureFocusedCiIntegrationPaths
	, directProofErasureFocusedCiNormalizationPaths
	, directProofErasureFocusedCiPredecessor
	, reverseDirectProofErasureFocusedCiUpdate
} from "./direct-proof-erasure-focused-ci-source-history.mjs";
import { sourceAtFinHistoryMilestone }
	from "./source-at-fin-history-milestone.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	directProofErasureFocusedCiHistoryPath, "utf8"));

test("focused proof-erasure CI records its exact implementation parent"
	, async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "direct-proof-erasure-focused-ci-source-v1");
	assert.equal(value.predecessorCommit
		, directProofErasureFocusedCiPredecessor);
	assert.equal(value.implementationCommit
		, directProofErasureFocusedCiImplementation);
	assert.equal(git(["rev-parse"
		, `${directProofErasureFocusedCiImplementation}^`]).trim()
		, directProofErasureFocusedCiPredecessor);
	}
);

test("focused proof-erasure CI reverses every implementation source"
	, async () => {
	const value = await record();
	assert.deepEqual(value.updates.map(update => update.path)
		, [...directProofErasureFocusedCiImplementationPaths]);
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${directProofErasureFocusedCiImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${directProofErasureFocusedCiPredecessor}:${update.path}`]);
		assert.equal(reverseDirectProofErasureFocusedCiUpdate(current, update)
			, previous, update.path);
	}}
);

test("focused proof-erasure CI authenticates new receipt controls"
	, async () => {
	const value = await record();
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, [...directProofErasureFocusedCiImplementationAdditions]);
	for(const addition of value.implementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${directProofErasureFocusedCiPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${directProofErasureFocusedCiImplementation}:${addition.path}`]))
			, addition.sha256, addition.path);
	}}
);

test("focused proof-erasure CI registration is exactly reversible"
	, async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...directProofErasureFocusedCiIntegrationPaths]);
	for(const update of value.integrationUpdates)
	{
		const live = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const implementation = git(["show"
			, `${directProofErasureFocusedCiImplementation}:${update.path}`]);
		assert.equal(reverseDirectProofErasureFocusedCiUpdate(live, update)
			, implementation, update.path);
	}}
);

test("focused proof-erasure CI owns no promoted type-surface source pins"
	, async () => {
	const value = await record();
	assert.equal(value.refreshedPins, 0);
	assert.deepEqual(value.currentSourcePaths, []);
		assert.deepEqual(value.currentSourceDigests, []);}
);

test("focused proof-erasure CI authenticates every history control"
	, async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...directProofErasureFocusedCiHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${directProofErasureFocusedCiImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(beforeDependentSignatureFocusedCiSource(
			addition.path, await readFile(addition.path, "utf8")
			, addition.sha256))
			, addition.sha256, addition.path);
	}
	for(const path of [
		...directProofErasureFocusedCiImplementationPaths
		, ...directProofErasureFocusedCiIntegrationPaths
	]) assert.ok(directProofErasureFocusedCiNormalizationPaths.includes(path)
		, path);
	}
);

test("focused proof-erasure CI normalizes current sources to its predecessor"
	, async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const live = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = beforeDirectProofErasureFocusedCiSource(
			update.path, live, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}}
);
