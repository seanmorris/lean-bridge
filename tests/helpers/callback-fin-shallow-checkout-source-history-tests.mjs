/**
 * Authenticate the shallow native callback-Fin workflow transition.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
	beforeCallbackFinShallowCheckoutSource
	, callbackFinShallowCheckoutAddedPaths
	, callbackFinShallowCheckoutHistoryPath
	, callbackFinShallowCheckoutImplementation
	, callbackFinShallowCheckoutImplementationPaths
	, callbackFinShallowCheckoutIntegrationPaths
	, callbackFinShallowCheckoutNormalizationPaths
	, callbackFinShallowCheckoutPinRepair
	, callbackFinShallowCheckoutPredecessor
	, reverseCallbackFinShallowCheckoutUpdate
} from "./callback-fin-shallow-checkout-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	callbackFinShallowCheckoutHistoryPath, "utf8"
));
const inventoryPath = "docs/type-surface.v1.json";
const oldInventory = "c005e32bc3b063c8603ce757c2f3c078204c2d1c3034f5b74d0320f889a03c42";
const newInventory = "48d6b23844ff38227d76c07a394b9fc296ffd2b679b7356cdaf40dc501997bca";
const workflowPath = ".github/workflows/callback-checked-record-languages.yml";
const oldWorkflow = "7b195e22f60a63348bd3a960058b471fe1a0ba22fc17c419446cf15e554ad4cf";
const newWorkflow = "aaec6ee5695b8741dce4800eed7e8823ab4347abbcc16d30e451a3483830d8a6";

test("callback Fin shallow checkout records its exact source range", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-shallow-checkout-source-v1");
	assert.equal(record.predecessorCommit, callbackFinShallowCheckoutPredecessor);
	assert.equal(record.implementationCommit, callbackFinShallowCheckoutImplementation);
	assert.equal(record.pinRepairCommit, callbackFinShallowCheckoutPinRepair);
	assert.equal(git(["rev-parse"
		, `${callbackFinShallowCheckoutImplementation}^`]).trim()
		, callbackFinShallowCheckoutPredecessor);
	assert.equal(git(["rev-parse"
		, `${callbackFinShallowCheckoutPinRepair}^`]).trim()
		, callbackFinShallowCheckoutImplementation);
	assert.deepEqual(names(["diff", "--name-only"
		, callbackFinShallowCheckoutPredecessor
		, callbackFinShallowCheckoutImplementation])
		, [...callbackFinShallowCheckoutImplementationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path)
		, callbackFinShallowCheckoutImplementationPaths);
	assert.deepEqual(record.pinUpdates.map(update => update.path), [inventoryPath]);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, callbackFinShallowCheckoutIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, callbackFinShallowCheckoutAddedPaths);
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${callbackFinShallowCheckoutImplementation}:${update.path}`]);
		assert.equal(current.match(/fetch-depth: 1/gmu)?.length, 2, update.path);
		assert.ok(!current.includes("fetch-depth: 0"), update.path);
	}
});

test("callback Fin shallow checkout repairs exactly its one live source pin", async () => {
	const [update] = (await readRecord()).pinUpdates;
	assert.equal(update.path, inventoryPath);
	assert.equal(update.previousSha256, oldInventory);
	assert.equal(update.currentSha256, newInventory);
	assert.equal(update.edits.length, 1);
	assert.equal(update.edits[0].previous.trim()
		, `"sha256": "${oldWorkflow}"`);
	assert.equal(update.edits[0].current.trim()
		, `"sha256": "${newWorkflow}"`);
	assert.equal(newWorkflow, sha256(git(["show"
		, `${callbackFinShallowCheckoutImplementation}:${workflowPath}`])));
	const current = git(["show"
		, `${callbackFinShallowCheckoutPinRepair}:${inventoryPath}`]);
	assert.equal(sha256(reverseCallbackFinShallowCheckoutUpdate(current, update))
		, oldInventory);
});

test("callback Fin shallow checkout reverses every source endpoint", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${callbackFinShallowCheckoutImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${callbackFinShallowCheckoutPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackFinShallowCheckoutUpdate(current, update), previous);
	}
	for(const update of record.pinUpdates)
	{
		const current = git(["show"
			, `${callbackFinShallowCheckoutPinRepair}:${update.path}`]);
		const previous = git(["show"
			, `${callbackFinShallowCheckoutImplementation}:${update.path}`]);
		assert.equal(reverseCallbackFinShallowCheckoutUpdate(current, update), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCallbackFinShallowCheckoutSource);
		const previous = git(["show"
			, `${callbackFinShallowCheckoutPinRepair}:${update.path}`]);
		assert.equal(reverseCallbackFinShallowCheckoutUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const path of callbackFinShallowCheckoutNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path));
});

test("callback Fin shallow checkout rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${callbackFinShallowCheckoutImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.yml" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCallbackFinShallowCheckoutUpdate(current, forged));
});

test("callback Fin shallow checkout writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-fin-shallow-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-shallow-checkout-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
