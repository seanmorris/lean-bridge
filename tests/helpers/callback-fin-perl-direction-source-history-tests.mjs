/**
 * Authenticate the exact Perl callback converter direction repair.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinPerlDirectionSource
	, callbackFinPerlDirectionAddedPaths
	, callbackFinPerlDirectionChangedPaths
	, callbackFinPerlDirectionHistoryPath
	, callbackFinPerlDirectionImplementation
	, callbackFinPerlDirectionIntegrationPaths
	, callbackFinPerlDirectionPredecessor
	, reverseCallbackFinPerlDirectionUpdate
} from "./callback-fin-perl-direction-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	callbackFinPerlDirectionHistoryPath, "utf8"
));

test("Perl callback direction repair retains its exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "callback-fin-perl-direction-source-v1");
	assert.equal(value.predecessorCommit, callbackFinPerlDirectionPredecessor);
	assert.equal(value.implementationCommit, callbackFinPerlDirectionImplementation);
	assert.equal(git(["show", "-s", "--format=%P"
		, callbackFinPerlDirectionImplementation]).trim()
	, callbackFinPerlDirectionPredecessor);
	assert.deepEqual(value.updates.map(item => item.path)
		, callbackFinPerlDirectionChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, callbackFinPerlDirectionIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, callbackFinPerlDirectionAddedPaths);
	for(const addition of value.additions)
		assert.equal(addition.currentSha256, sha256(await readFile(addition.path)));
});

test("Perl callback direction repair reverses every exact transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show", `${value.implementationCommit}:${update.path}`]);
		const previous = git(["show", `${value.predecessorCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinPerlDirectionUpdate(current, update), previous);
		assert.equal(beforeCallbackFinPerlDirectionSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show", `${value.implementationCommit}:${update.path}`]);
		assert.equal(reverseCallbackFinPerlDirectionUpdate(current, update), previous);
	}
});

test("Perl callback direction repair rejects forgeries and repeat writes", async () => {
	const value = await read(), update = value.updates[0];
	const current = git(["show", `${value.implementationCommit}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseCallbackFinPerlDirectionUpdate(current, forged));
	assert.equal(beforeCallbackFinPerlDirectionSource("unrelated.mjs", current), current);
	const before = await readFile(callbackFinPerlDirectionHistoryPath);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-perl-direction-source-history.mjs"
	)], { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(callbackFinPerlDirectionHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		callbackFinPerlDirectionHistoryPath.split("/").at(-1)
	));
});
