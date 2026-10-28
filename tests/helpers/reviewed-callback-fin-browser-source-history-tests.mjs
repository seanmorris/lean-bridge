/**
 * Authenticate the reviewed callback-Fin browser source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeReviewedCallbackFinBrowserSource
	, reviewedCallbackFinBrowserAddedPaths
	, reviewedCallbackFinBrowserChangedPaths
	, reviewedCallbackFinBrowserHistoryPath
	, reviewedCallbackFinBrowserImplementation
	, reviewedCallbackFinBrowserIntegrationPaths
	, reviewedCallbackFinBrowserPredecessor
	, reverseReviewedCallbackFinBrowserUpdate
} from "./reviewed-callback-fin-browser-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(
	reviewedCallbackFinBrowserHistoryPath
));

test("reviewed callback Fin browser history retains exact implementation and integration", async () => {
	const value = await read();
	assert.equal(value.schemaVersion, 1);
	assert.equal(value.milestone, "reviewed-callback-fin-browser-source-v1");
	assert.equal(value.predecessorCommit, reviewedCallbackFinBrowserPredecessor);
	assert.equal(value.implementationCommit, reviewedCallbackFinBrowserImplementation);
	assert.equal(git(["show", "-s", "--format=%P"
		, reviewedCallbackFinBrowserImplementation]).trim()
		, reviewedCallbackFinBrowserPredecessor);
	assert.deepEqual(value.updates.map(item => item.path)
		, reviewedCallbackFinBrowserChangedPaths);
	assert.deepEqual(value.integrationUpdates.map(item => item.path)
		, reviewedCallbackFinBrowserIntegrationPaths);
	assert.deepEqual(value.additions.map(item => item.path)
		, reviewedCallbackFinBrowserAddedPaths);
	for(const addition of value.additions)
		assert.equal(addition.currentSha256, sha256(await readFile(addition.path)));
});

test("reviewed callback Fin browser history reverses every exact source transition", async () => {
	const value = await read();
	for(const update of value.updates)
	{
		const current = git(["show"
			, `${reviewedCallbackFinBrowserImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${reviewedCallbackFinBrowserPredecessor}:${update.path}`]);
		assert.equal(reverseReviewedCallbackFinBrowserUpdate(current, update)
			, previous);
		assert.equal(beforeReviewedCallbackFinBrowserSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const update of value.integrationUpdates)
	{
		const current = await readFile(update.path, "utf8");
		const previous = git(["show"
			, `${reviewedCallbackFinBrowserImplementation}:${update.path}`]);
		assert.equal(reverseReviewedCallbackFinBrowserUpdate(current, update)
			, previous);
	}
});

test("reviewed callback Fin browser history refuses altered transitions and repeat writes", async () => {
	const update = (await read()).updates[0];
	const current = git(["show"
		, `${reviewedCallbackFinBrowserImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.mjs" }, { ...update, edits: [] }
	]) assert.throws(() => reverseReviewedCallbackFinBrowserUpdate(current, forged));
	assert.equal(beforeReviewedCallbackFinBrowserSource("unrelated.mjs", current)
		, current);
	const before = await readFile(reviewedCallbackFinBrowserHistoryPath);
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-reviewed-callback-fin-browser-source-history.mjs"
	)], { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(reviewedCallbackFinBrowserHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		reviewedCallbackFinBrowserHistoryPath.split("/").at(-1)
	));
});
