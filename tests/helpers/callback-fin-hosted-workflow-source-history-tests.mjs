/**
 * Authenticate the callback Fin hosted-workflow source transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinHostedWorkflowSource
	, callbackFinHostedWorkflowAddedPaths
	, callbackFinHostedWorkflowChangedPaths
	, callbackFinHostedWorkflowHistoryPath
	, callbackFinHostedWorkflowImplementation
	, callbackFinHostedWorkflowIntegrationPaths
	, callbackFinHostedWorkflowPins
	, callbackFinHostedWorkflowPredecessor
	, callbackFinHostedWorkflowRemovedPaths
	, reverseCallbackFinHostedWorkflowUpdate
} from "./callback-fin-hosted-workflow-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const read = async () => JSON.parse(await readFile(callbackFinHostedWorkflowHistoryPath));

test("callback Fin hosted workflows retain their exact implementation and integration", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-hosted-workflow-source-v1");
	assert.equal(record.predecessorCommit, callbackFinHostedWorkflowPredecessor);
	assert.equal(record.implementationCommit, callbackFinHostedWorkflowImplementation);
	assert.equal(git(["show", "-s", "--format=%P", callbackFinHostedWorkflowImplementation]).trim()
		, callbackFinHostedWorkflowPredecessor);
	assert.deepEqual(record.updates.map(item => item.path), callbackFinHostedWorkflowChangedPaths);
	assert.deepEqual(record.integrationUpdates.map(item => item.path), callbackFinHostedWorkflowIntegrationPaths);
	assert.deepEqual(record.removals.map(item => item.path), callbackFinHostedWorkflowRemovedPaths);
	for(const removal of record.removals)
	{
		assert.equal(removal.previousSha256
			, sha256(git(["show", `${callbackFinHostedWorkflowPredecessor}:${removal.path}`])));
		assert.equal(git([
			"ls-tree", "--name-only"
			, callbackFinHostedWorkflowImplementation, "--", removal.path
		]).trim(), "");
	}
	assert.deepEqual(record.additions.map(item => item.path), callbackFinHostedWorkflowAddedPaths);
	for(const addition of record.additions)
		assert.equal(addition.currentSha256, sha256(await sourceAtFinHistoryMilestone(
			addition.path, addition.currentSha256)));
});

test("callback Fin hosted workflow history reverses every exact source transition", async () => {
	const record = await read();
	for(const update of record.updates)
	{
		const current = git(["show", `${callbackFinHostedWorkflowImplementation}:${update.path}`]);
		const previous = git(["show", `${callbackFinHostedWorkflowPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackFinHostedWorkflowUpdate(current, update), previous);
		assert.equal(beforeCallbackFinHostedWorkflowSource(update.path, current, update.previousSha256), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(
			update.path, update.currentSha256);
		const previous = git(["show", `${callbackFinHostedWorkflowImplementation}:${update.path}`]);
		assert.equal(reverseCallbackFinHostedWorkflowUpdate(current, update), previous);
	}
});

test("callback Fin workflow integration repairs exactly two live inventory pins", async () => {
	// The pins are checked at this layer's own inventory milestone, not the live tree.
	const inventory = (await read()).integrationUpdates
		.find(update => update.path === "docs/type-surface.v1.json");
	const document = JSON.parse(await sourceAtFinHistoryMilestone(
		inventory.path, inventory.currentSha256));
	for(const pin of callbackFinHostedWorkflowPins)
	{
		const files = document.evidence.flatMap(item => item.files)
			.filter(item => item.path === pin.path);
		assert.equal(files.length, pin.count, pin.path);
		assert.ok(files.every(item => item.sha256 === pin.currentSha256), pin.path);
		assert.equal(sha256(git(["show", `${callbackFinHostedWorkflowPredecessor}:${pin.path}`]))
			, pin.previousSha256);
		assert.equal(sha256(git(["show", `${callbackFinHostedWorkflowImplementation}:${pin.path}`]))
			, pin.currentSha256);
	}
	const perl = document.evidence.flatMap(item => item.files)
		.filter(item => item.path === ".github/workflows/callback-checked-record-perl.yml");
	assert.equal(perl.length, 0);
});

test("callback Fin workflow history refuses altered transitions and repeat writes", async () => {
	const update = (await read()).updates[0];
	const current = git(["show", `${callbackFinHostedWorkflowImplementation}:${update.path}`]);
	for(const forged of [
		{ ...update, previousSha256: "0".repeat(64) }
		, { ...update, currentSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.yml" }
		, { ...update, edits: [] }
	]) assert.throws(() => reverseCallbackFinHostedWorkflowUpdate(current, forged));
	assert.equal(beforeCallbackFinHostedWorkflowSource("unrelated.yml", current), current);
	const before = await readFile(callbackFinHostedWorkflowHistoryPath);
	const result = spawnSync(process.execPath
		, [resolve("scripts/update-callback-fin-hosted-workflow-source-history.mjs")]
		, { encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.deepEqual(await readFile(callbackFinHostedWorkflowHistoryPath), before);
	assert.ok((await readdir("docs/evidence")).includes(
		callbackFinHostedWorkflowHistoryPath.split("/").at(-1)));
});
