/**
 * Authenticate the exact installed callback-Fin Ruby and Perl host repairs.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinHostRepairSource
	, callbackFinHostRepairAddedPaths
	, callbackFinHostRepairChangedPaths
	, callbackFinHostRepairHistoryPath
	, callbackFinHostRepairImplementation
	, callbackFinHostRepairIntegrationPaths
	, callbackFinHostRepairPredecessor
	, reverseCallbackFinHostRepairUpdate
} from "./callback-fin-host-repair-source-history.mjs";
import { beforeCallbackFinPerlDirectionSource } from "./callback-fin-perl-direction-source-history.mjs";
import { beforeCallbackFinPerlRuntimeSource } from "./callback-fin-perl-runtime-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	callbackFinHostRepairHistoryPath, "utf8"
));

test("callback Fin host repair retains its exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "callback-fin-host-repair-source-v1");
	assert.equal(value.predecessorCommit, callbackFinHostRepairPredecessor);
	assert.equal(value.implementationCommit, callbackFinHostRepairImplementation);
	assert.equal(git(["show", "-s", "--format=%P"
		, callbackFinHostRepairImplementation]).trim()
	, callbackFinHostRepairPredecessor);
	assert.deepEqual(value.updates.map(item => item.path)
		, callbackFinHostRepairChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, callbackFinHostRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, callbackFinHostRepairAddedPaths);
	for(const addition of value.additions)
	{
		const live = await readFile(addition.path, "utf8");
		const afterRuntime = beforeCallbackFinPerlRuntimeSource(
			addition.path, live
		);
		const source = beforeCallbackFinPerlDirectionSource(
			addition.path, afterRuntime, addition.currentSha256
		);
		assert.equal(addition.currentSha256, sha256(source));
	}
});

test("callback Fin host repair reverses every exact transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show", `${value.implementationCommit}:${update.path}`]);
		const previous = git(["show", `${value.predecessorCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinHostRepairUpdate(current, update), previous);
		assert.equal(beforeCallbackFinHostRepairSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const live = await readFile(update.path, "utf8");
		const afterRuntime = beforeCallbackFinPerlRuntimeSource(
			update.path, live
		);
		const current = beforeCallbackFinPerlDirectionSource(
			update.path, afterRuntime, update.currentSha256
		);
		const previous = git(["show", `${value.implementationCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinHostRepairUpdate(current, update), previous);
	}
});

test("callback Fin host repair rejects forgeries and repeat writes", async () => {
	const value = await read(), update = value.updates[0];
	const current = git(["show", `${value.implementationCommit}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseCallbackFinHostRepairUpdate(current, forged));
	assert.equal(beforeCallbackFinHostRepairSource("unrelated.mjs", current), current);
	const before = await readFile(callbackFinHostRepairHistoryPath);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-host-repair-source-history.mjs"
	)], { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(callbackFinHostRepairHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		callbackFinHostRepairHistoryPath.split("/").at(-1)
	));
});
