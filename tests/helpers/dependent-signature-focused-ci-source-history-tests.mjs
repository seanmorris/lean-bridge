/**
 * Qualify the bounded dependent-signature producer and exact-run receipt.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeDependentSignatureFocusedCiSource
	, dependentSignatureFocusedCiHistoryAdditions
	, dependentSignatureFocusedCiHistoryPath
	, dependentSignatureFocusedCiImplementation
	, dependentSignatureFocusedCiImplementationAdditions
	, dependentSignatureFocusedCiImplementationPaths
	, dependentSignatureFocusedCiIntegrationPaths
	, dependentSignatureFocusedCiNormalizationPaths
	, dependentSignatureFocusedCiPredecessor
	, reverseDependentSignatureFocusedCiUpdate
} from "./dependent-signature-focused-ci-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	dependentSignatureFocusedCiHistoryPath, "utf8"));

test("focused dependent-signature CI records its exact implementation parent"
	, async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "dependent-signature-focused-ci-source-v1");
	assert.equal(value.predecessorCommit
		, dependentSignatureFocusedCiPredecessor);
	assert.equal(value.implementationCommit
		, dependentSignatureFocusedCiImplementation);
	assert.equal(git(["rev-parse"
		, `${dependentSignatureFocusedCiImplementation}^`]).trim()
		, dependentSignatureFocusedCiPredecessor);
	assert.deepEqual({
		calledWorkflowCount: value.calledWorkflowCount
		, producerJobCount: value.producerJobCount
		, receiptJobCount: value.receiptJobCount
		, artifactCount: value.artifactCount, reportCount: value.reportCount
		, profileCount: value.profileCount
		, authorRouteCount: value.authorRouteCount
		, apiModeCount: value.apiModeCount, cellCount: value.cellCount
	}, {
		calledWorkflowCount: 11, producerJobCount: 11, receiptJobCount: 1
		, artifactCount: 11, reportCount: 44, profileCount: 17
		, authorRouteCount: 2, apiModeCount: 2, cellCount: 34
	});}
);

test("focused dependent-signature CI reverses every implementation source"
	, async () => {
	const value = await record();
	assert.deepEqual(value.updates.map(update => update.path)
		, [...dependentSignatureFocusedCiImplementationPaths]);
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${dependentSignatureFocusedCiImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${dependentSignatureFocusedCiPredecessor}:${update.path}`]);
		assert.equal(reverseDependentSignatureFocusedCiUpdate(current, update)
			, previous, update.path);
	}}
);

test("focused dependent-signature CI authenticates new receipt controls"
	, async () => {
	const value = await record();
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, [...dependentSignatureFocusedCiImplementationAdditions]);
	for(const addition of value.implementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${dependentSignatureFocusedCiPredecessor}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(git(["show"
			, `${dependentSignatureFocusedCiImplementation}:${addition.path}`]))
			, addition.sha256, addition.path);
	}}
);

test("focused dependent-signature CI registration is exactly reversible"
	, async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...dependentSignatureFocusedCiIntegrationPaths]);
	for(const update of value.integrationUpdates)
	{
		const live = await readFile(update.path, "utf8");
		const implementation = git(["show"
			, `${dependentSignatureFocusedCiImplementation}:${update.path}`]);
		assert.equal(reverseDependentSignatureFocusedCiUpdate(live, update)
			, implementation, update.path);
	}}
);

test("focused dependent-signature CI owns no promoted type-surface pins"
	, async () => {
	const value = await record();
	assert.equal(value.refreshedPins, 0);
	assert.deepEqual(value.currentSourcePaths, []);
		assert.deepEqual(value.currentSourceDigests, []);}
);

test("focused dependent-signature CI authenticates every history control"
	, async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...dependentSignatureFocusedCiHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${dependentSignatureFocusedCiImplementation}:${addition.path}`]
			, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(await readFile(addition.path))
			, addition.sha256, addition.path);
	}
	for(const path of [
		...dependentSignatureFocusedCiImplementationPaths
		, ...dependentSignatureFocusedCiIntegrationPaths
	]) assert.ok(dependentSignatureFocusedCiNormalizationPaths.includes(path)
		, path);
	}
);

test("focused dependent-signature CI normalizes sources to its predecessor"
	, async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const live = await readFile(update.path, "utf8");
		const previous = beforeDependentSignatureFocusedCiSource(
			update.path, live, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}}
);
