/**
 * Qualify the dual-parent optional-parameter integration and pin refresh.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	beforeOptionalParameterCurrentLineIntegrationSource
	, optionalParameterCurrentLineIntegrationAddedPaths
	, optionalParameterCurrentLineIntegrationCurrentParent
	, optionalParameterCurrentLineIntegrationHistoryPath
	, optionalParameterCurrentLineIntegrationMerge
	, optionalParameterCurrentLineIntegrationNormalizationPaths
	, optionalParameterCurrentLineIntegrationOptionalParent
	, optionalParameterCurrentLineIntegrationPaths
	, optionalParameterCurrentLineIntegrationRegistrationPaths
	, reverseOptionalParameterCurrentLineIntegrationUpdate
} from "./optional-parameter-current-line-integration-source-history.mjs";
import { beforeOptionalParameterFocusedCiSource }
	from "./optional-parameter-focused-ci-source-history.mjs";
import { beforeOptionalParameterDispatchBridgeSource }
	from "./optional-parameter-dispatch-bridge-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_, {
	encoding: "utf8", maxBuffer: 512 * 1024 * 1024
});
const record = async () => JSON.parse(await readFile(
	optionalParameterCurrentLineIntegrationHistoryPath, "utf8"));

test("optional parameter integration retains both exact parents", async () => {
	const value = await record();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone
		, "optional-parameter-current-line-integration-source-v1");
	assert.equal(value.mergeCommit
		, optionalParameterCurrentLineIntegrationMerge);
	assert.equal(value.currentParent
		, optionalParameterCurrentLineIntegrationCurrentParent);
	assert.equal(value.optionalParent
		, optionalParameterCurrentLineIntegrationOptionalParent);
	assert.equal(git(["show", "-s", "--format=%P"
		, optionalParameterCurrentLineIntegrationMerge]).trim()
		, `${optionalParameterCurrentLineIntegrationCurrentParent} ${optionalParameterCurrentLineIntegrationOptionalParent}`);
});

test("optional parameter integration reverses every current-parent source", async () => {
	const value = await record();
	assert.equal(value.currentParentUpdates.length, 47);
	for(const update of value.currentParentUpdates)
	{
		const current = git(["show"
			, `${optionalParameterCurrentLineIntegrationMerge}:${update.path}`]);
		const previous = git(["show"
			, `${optionalParameterCurrentLineIntegrationCurrentParent}:${update.path}`]);
		assert.equal(reverseOptionalParameterCurrentLineIntegrationUpdate(
			current, update), previous, update.path);
	}
});

test("optional parameter integration can select the sealed optional parent", async () => {
	const value = await record();
	assert.deepEqual(value.optionalParentUpdates.map(item => item.path)
		, [...optionalParameterCurrentLineIntegrationPaths]);
	for(const update of value.optionalParentUpdates)
	{
		const live = beforeOptionalParameterFocusedCiSource(update.path
			, beforeOptionalParameterDispatchBridgeSource(update.path
				, await readFile(update.path, "utf8")));
		const optional = git(["show"
			, `${optionalParameterCurrentLineIntegrationOptionalParent}:${update.path}`]);
		assert.equal(beforeOptionalParameterCurrentLineIntegrationSource(
			update.path, live, update.previousSha256), optional, update.path);
	}
});

test("optional parameter integration registration is exactly reversible", async () => {
	const value = await record();
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, ["docs/type-surface.v1.json"
			, ...optionalParameterCurrentLineIntegrationRegistrationPaths]);
	for(const update of value.integrationUpdates)
	{
		const live = beforeOptionalParameterFocusedCiSource(update.path
			, beforeOptionalParameterDispatchBridgeSource(update.path
				, await readFile(update.path, "utf8")));
		const merged = git(["show"
			, `${optionalParameterCurrentLineIntegrationMerge}:${update.path}`]);
		assert.equal(reverseOptionalParameterCurrentLineIntegrationUpdate(
			live, update), merged, update.path);
	}
});

test("optional parameter integration changes only current-source hashes", async () => {
	const value = await record();
	assert.ok(value.refreshedPins > 0);
	assert.equal(value.currentSourceDigests.length, value.currentSourcePaths.length);
	assert.deepEqual(value.currentSourceDigests.map(item => item.path)
		, value.currentSourcePaths);
	for(const item of value.currentSourceDigests)
	{
		const live = beforeOptionalParameterFocusedCiSource(item.path
			, beforeOptionalParameterDispatchBridgeSource(item.path
				, await readFile(item.path, "utf8"), item.sha256), item.sha256);
		assert.equal(sha256(live), item.sha256, item.path);
	}
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

test("optional parameter integration authenticates every added control", async () => {
	const value = await record();
	assert.deepEqual(value.additions.map(item => item.path)
		, [...optionalParameterCurrentLineIntegrationAddedPaths]);
	for(const addition of value.additions)
	{
		assert.notEqual(spawnSync("git", ["cat-file", "-e"
			, `${optionalParameterCurrentLineIntegrationMerge}:${addition.path}`]
		, { stdio: "ignore" }).status, 0, addition.path);
		const live = beforeOptionalParameterFocusedCiSource(addition.path
			, beforeOptionalParameterDispatchBridgeSource(addition.path
				, await readFile(addition.path, "utf8")));
		assert.equal(sha256(live)
			, addition.sha256, addition.path);
	}
	for(const path of optionalParameterCurrentLineIntegrationPaths)
		assert.ok(optionalParameterCurrentLineIntegrationNormalizationPaths
			.includes(path), path);
});
