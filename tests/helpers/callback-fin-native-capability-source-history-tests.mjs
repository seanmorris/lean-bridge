/**
 * Authenticate the native callback Fin capability-gate repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinNativeCapabilitySource
	, callbackFinNativeCapabilityAddedPaths
	, callbackFinNativeCapabilityChangedPaths
	, callbackFinNativeCapabilityHistoryPath
	, callbackFinNativeCapabilityImplementation
	, callbackFinNativeCapabilityIntegrationPaths
	, callbackFinNativeCapabilityPins
	, callbackFinNativeCapabilityPredecessor
	, reverseCallbackFinNativeCapabilityUpdate
} from "./callback-fin-native-capability-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	callbackFinNativeCapabilityHistoryPath
));

test("native callback Fin capability history retains the exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "callback-fin-native-capability-source-v1");
	assert.equal(value.predecessorCommit, callbackFinNativeCapabilityPredecessor);
	assert.equal(value.implementationCommit, callbackFinNativeCapabilityImplementation);
	assert.equal(git(["show", "-s", "--format=%P", callbackFinNativeCapabilityImplementation]).trim(), callbackFinNativeCapabilityPredecessor);
	assert.deepEqual(value.updates.map(item => item.path), callbackFinNativeCapabilityChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path), callbackFinNativeCapabilityIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path), callbackFinNativeCapabilityAddedPaths);
	for(const addition of value.additions)
		assert.equal(addition.currentSha256, sha256(await readFile(addition.path)));
});

test("native callback Fin capability history reverses every exact source transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show", `${callbackFinNativeCapabilityImplementation}:${update.path}`]);
		const previous = git(["show", `${callbackFinNativeCapabilityPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackFinNativeCapabilityUpdate(current, update), previous);
		assert.equal(beforeCallbackFinNativeCapabilitySource(update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show", `${callbackFinNativeCapabilityImplementation}:${update.path}`]);
		assert.equal(reverseCallbackFinNativeCapabilityUpdate(current, update), previous);
	}
});

test("native callback Fin capability integration repairs every cited live source", async () => {
	const document = JSON.parse(await readFile("docs/type-surface.v1.json"));
	for(const pin of callbackFinNativeCapabilityPins)
	{
		const files = document.evidence.flatMap(item => item.files)
			.filter(item => item.path === pin.path);
		assert.equal(files.length, pin.count, pin.path);
		assert.ok(files.every(item => item.sha256 === pin.currentSha256), pin.path);
		assert.equal(sha256(git(["show", `${callbackFinNativeCapabilityPredecessor}:${pin.path}`])), pin.previousSha256);
		assert.equal(sha256(git(["show", `${callbackFinNativeCapabilityImplementation}:${pin.path}`])), pin.currentSha256);
	}
});

test("native callback Fin capability history refuses altered transitions and repeat writes", async () => {
	const update = (await read()).updates[0];
	const current = git(["show", `${callbackFinNativeCapabilityImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCallbackFinNativeCapabilityUpdate(current, forged));
	assert.equal(beforeCallbackFinNativeCapabilitySource("unrelated.mjs", current), current);
	const before = await readFile(callbackFinNativeCapabilityHistoryPath);
	const result = spawnSync(process.execPath
		, [resolve("scripts/update-callback-fin-native-capability-source-history.mjs")]
		, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(callbackFinNativeCapabilityHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		callbackFinNativeCapabilityHistoryPath.split("/").at(-1)));
});
