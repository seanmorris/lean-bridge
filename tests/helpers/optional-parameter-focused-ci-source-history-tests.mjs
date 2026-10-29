/**
 * Qualify the focused optional-parameter CI implementation and registration.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterFocusedCiSource
	, optionalParameterFocusedCiHistoryAdditions
	, optionalParameterFocusedCiHistoryPath
	, optionalParameterFocusedCiImplementation
	, optionalParameterFocusedCiImplementationAdditions
	, optionalParameterFocusedCiImplementationPaths
	, optionalParameterFocusedCiIntegrationPaths
	, optionalParameterFocusedCiNormalizationPaths
	, optionalParameterFocusedCiPredecessor
	, reverseOptionalParameterFocusedCiUpdate
} from "./optional-parameter-focused-ci-source-history.mjs";
import { beforeOptionalParameterDispatchBridgeSource }
	from "./optional-parameter-dispatch-bridge-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterFocusedCiHistoryPath, "utf8"));

test("focused optional CI records its exact implementation parent", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "optional-parameter-focused-ci-source-v1");
	assert.equal(value.predecessorCommit
		, optionalParameterFocusedCiPredecessor);
	assert.equal(value.implementationCommit
		, optionalParameterFocusedCiImplementation);
	assert.equal(git(["rev-parse"
		, `${optionalParameterFocusedCiImplementation}^`]).trim()
		, optionalParameterFocusedCiPredecessor);
});

test("focused optional CI reverses every modified implementation source", async () => {
	const value = await record();
	assert.deepEqual(value.updates.map(update => update.path)
		, [...optionalParameterFocusedCiImplementationPaths]);
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${optionalParameterFocusedCiImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterFocusedCiPredecessor}:${update.path}`]);
		assert.equal(reverseOptionalParameterFocusedCiUpdate(current, update)
			, previous, update.path);
	}
});

test("focused optional CI authenticates the new reusable caller", async () => {
	const value = await record();
	assert.deepEqual(value.implementationAdditions.map(item => item.path)
		, [...optionalParameterFocusedCiImplementationAdditions]);
	for(const addition of value.implementationAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalParameterFocusedCiPredecessor}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		const source = git(["show"
			, `${optionalParameterFocusedCiImplementation}:${addition.path}`]);
		assert.equal(sha256(source), addition.sha256, addition.path);
	}
});

test("focused optional CI registration is exactly reversible", async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(update => update.path)
		, [...optionalParameterFocusedCiIntegrationPaths]);
	for(const update of value.integrationUpdates)
	{
		const live = beforeOptionalParameterDispatchBridgeSource(update.path
			, await readFile(update.path, "utf8"));
		const implementation = git(["show"
			, `${optionalParameterFocusedCiImplementation}:${update.path}`]);
		assert.equal(reverseOptionalParameterFocusedCiUpdate(live, update)
			, implementation, update.path);
	}
});

test("focused optional CI changes only existing live-source hashes", async () => {
	const value = await record();
	assert.ok(value.refreshedPins > 0);
	assert.deepEqual(value.currentSourceDigests.map(item => item.path)
		, value.currentSourcePaths);
	for(const item of value.currentSourceDigests)
		assert.equal(sha256(beforeOptionalParameterDispatchBridgeSource(item.path
			, await readFile(item.path, "utf8"), item.sha256))
			, item.sha256, item.path);
	const inventory = value.integrationUpdates.find(item =>
		item.path === "docs/type-surface.v1.json");
	let pins = 0;
	for(const edit of inventory.edits)
	{
		assert.equal(edit.current.replace(/[0-9a-f]{64}/gu, "<sha256>")
			, edit.previous.replace(/[0-9a-f]{64}/gu, "<sha256>"));
		pins += edit.current.match(/[0-9a-f]{64}/gu)?.length ?? 0;
	}
	assert.equal(pins, value.refreshedPins);
});

test("focused optional CI authenticates every history control", async () => {
	const value = await record();
	assert.deepEqual(value.historyAdditions.map(item => item.path)
		, [...optionalParameterFocusedCiHistoryAdditions]);
	for(const addition of value.historyAdditions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalParameterFocusedCiImplementation}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		assert.equal(sha256(beforeOptionalParameterDispatchBridgeSource(
			addition.path, await readFile(addition.path, "utf8")
			, addition.sha256)), addition.sha256, addition.path);
	}
	for(const path of [
		...optionalParameterFocusedCiImplementationPaths
		, ...optionalParameterFocusedCiIntegrationPaths
	]) assert.ok(optionalParameterFocusedCiNormalizationPaths.includes(path)
		, path);
});

test("focused optional CI normalizes current sources to the predecessor", async () => {
	const value = await record();
	for(const update of value.updates)
	{
		const live = beforeOptionalParameterDispatchBridgeSource(update.path
			, await readFile(update.path, "utf8"));
		const previous = beforeOptionalParameterFocusedCiSource(
			update.path, live, update.previousSha256);
		assert.equal(sha256(previous), update.previousSha256, update.path);
	}
});
