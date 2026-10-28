/**
 * Authenticate the exact installed callback-Fin repair transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinInstalledRepairSource
	, callbackFinInstalledRepairAddedPaths
	, callbackFinInstalledRepairChangedPaths
	, callbackFinInstalledRepairHistoryPath
	, callbackFinInstalledRepairImplementation
	, callbackFinInstalledRepairIntegrationPaths
	, callbackFinInstalledRepairPredecessor
	, reverseCallbackFinInstalledRepairUpdate
} from "./callback-fin-installed-repair-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	callbackFinInstalledRepairHistoryPath
));

test("installed callback Fin repair history retains exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "callback-fin-installed-repair-source-v1");
	assert.equal(value.predecessorCommit, callbackFinInstalledRepairPredecessor);
	assert.equal(value.implementationCommit
		, git(["rev-parse", callbackFinInstalledRepairImplementation]).trim());
	assert.equal(git(["show", "-s", "--format=%P"
		, value.implementationCommit]).trim(), callbackFinInstalledRepairPredecessor);
	assert.deepEqual(value.updates.map(item => item.path)
		, callbackFinInstalledRepairChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, callbackFinInstalledRepairIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, callbackFinInstalledRepairAddedPaths);
	for(const addition of value.additions)
		assert.equal(addition.currentSha256, sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)));
});

test("installed callback Fin repair history reverses every exact transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show", `${value.implementationCommit}:${update.path}`]);
		const previous = git(["show", `${value.predecessorCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinInstalledRepairUpdate(current, update), previous);
		assert.equal(beforeCallbackFinInstalledRepairSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show", `${value.implementationCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinInstalledRepairUpdate(current, update), previous);
	}
});

test("installed callback Fin repair history refuses forgeries and repeat writes", async () => {
	const value = await read(), update = value.updates[0];
	const current = git(["show", `${value.implementationCommit}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseCallbackFinInstalledRepairUpdate(current, forged));
	assert.equal(beforeCallbackFinInstalledRepairSource("unrelated.mjs", current)
		, current);
	const before = await readFile(callbackFinInstalledRepairHistoryPath);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-installed-repair-source-history.mjs"
	)], { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(callbackFinInstalledRepairHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		callbackFinInstalledRepairHistoryPath.split("/").at(-1)
	));
});
