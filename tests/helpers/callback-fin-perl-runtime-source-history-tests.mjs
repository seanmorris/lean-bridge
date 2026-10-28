/**
 * Authenticate the exact installed Perl callback Fin runtime completion.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinPerlRuntimeSource
	, callbackFinPerlRuntimeAddedPaths
	, callbackFinPerlRuntimeChangedPaths
	, callbackFinPerlRuntimeHistoryPath
	, callbackFinPerlRuntimeImplementation
	, callbackFinPerlRuntimeIntegrationPaths
	, callbackFinPerlRuntimePredecessor
	, reverseCallbackFinPerlRuntimeUpdate
} from "./callback-fin-perl-runtime-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	callbackFinPerlRuntimeHistoryPath, "utf8"
));

test("Perl callback Fin runtime retains its exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "callback-fin-perl-runtime-source-v1");
	assert.equal(value.predecessorCommit, callbackFinPerlRuntimePredecessor);
	assert.equal(value.implementationCommit, callbackFinPerlRuntimeImplementation);
	assert.equal(git(["show", "-s", "--format=%P"
		, callbackFinPerlRuntimeImplementation]).trim()
	, callbackFinPerlRuntimePredecessor);
	assert.deepEqual(value.updates.map(item => item.path)
		, callbackFinPerlRuntimeChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, callbackFinPerlRuntimeIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, callbackFinPerlRuntimeAddedPaths);
	for(const addition of value.additions)
		assert.equal(sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)), addition.currentSha256);
});

test("Perl callback Fin runtime reverses every exact transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show", `${value.implementationCommit}:${update.path}`]);
		const previous = git(["show", `${value.predecessorCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinPerlRuntimeUpdate(current, update), previous);
		assert.equal(beforeCallbackFinPerlRuntimeSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show", `${value.implementationCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinPerlRuntimeUpdate(current, update), previous);
	}
});

test("Perl callback Fin runtime rejects forgeries and repeat writes", async () => {
	const value = await read(), update = value.updates[0];
	const current = git(["show", `${value.implementationCommit}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseCallbackFinPerlRuntimeUpdate(current, forged));
	assert.equal(beforeCallbackFinPerlRuntimeSource("unrelated.mjs", current), current);
	const before = await readFile(callbackFinPerlRuntimeHistoryPath);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-perl-runtime-source-history.mjs"
	)], { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(callbackFinPerlRuntimeHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		callbackFinPerlRuntimeHistoryPath.split("/").at(-1)
	));
});
