/**
 * Authenticate the sparse native callback-Fin workflow transition.
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
	beforeCallbackFinSparseCheckoutSource
	, callbackFinSparseCheckoutAddedPaths
	, callbackFinSparseCheckoutHistoryPath
	, callbackFinSparseCheckoutImplementation
	, callbackFinSparseCheckoutImplementationPaths
	, callbackFinSparseCheckoutIntegrationPaths
	, callbackFinSparseCheckoutNormalizationPaths
	, callbackFinSparseCheckoutPinRepair
	, callbackFinSparseCheckoutPredecessor
	, reverseCallbackFinSparseCheckoutUpdate
} from "./callback-fin-sparse-checkout-source-history.mjs";
import {
	beforeFinRefinementSource, finRefinementNormalizationPaths
} from "./fin-refinement-source-history.mjs";
import { sha256 } from "./source-history-digest.mjs";
import { sourceAtFinHistoryMilestone } from "./source-at-fin-history-milestone.mjs";

const git = arguments_ => execFileSync("git", arguments_
	, { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
const names = arguments_ => git(arguments_).trim().split("\n").filter(Boolean).sort();
const readRecord = async () => JSON.parse(await readFile(
	callbackFinSparseCheckoutHistoryPath, "utf8"
));
const inventoryPath = "docs/type-surface.v1.json";
const oldInventory = "48d6b23844ff38227d76c07a394b9fc296ffd2b679b7356cdaf40dc501997bca";
const newInventory = "5d0beb94b6f277491d4a6fbecabcb99f75cd1aeedbb3e6c6fd9f31ebcbed0982";
const workflowPath = ".github/workflows/callback-checked-record-languages.yml";
const oldWorkflow = "aaec6ee5695b8741dce4800eed7e8823ab4347abbcc16d30e451a3483830d8a6";
const newWorkflow = "978d7c7ad6ba72c185ed53453fa3cedbae28a2a1760f3d1bd484bb4a83a44c13";

test("callback Fin sparse checkout records its exact source range", async () => {
	const record = await readRecord();
	assert.equal(record.schemaVersion, 1);
	assert.equal(record.milestone, "callback-fin-sparse-checkout-source-v1");
	assert.equal(record.predecessorCommit, callbackFinSparseCheckoutPredecessor);
	assert.equal(record.implementationCommit, callbackFinSparseCheckoutImplementation);
	assert.equal(record.pinRepairCommit, callbackFinSparseCheckoutPinRepair);
	assert.equal(git(["rev-parse"
		, `${callbackFinSparseCheckoutImplementation}^`]).trim()
		, callbackFinSparseCheckoutPredecessor);
	assert.equal(git(["rev-parse"
		, `${callbackFinSparseCheckoutPinRepair}^`]).trim()
		, callbackFinSparseCheckoutImplementation);
	assert.equal(git(["rev-parse", `${record.integrationCommit}^`]).trim()
		, callbackFinSparseCheckoutPinRepair);
	assert.deepEqual(names(["diff", "--name-only"
		, callbackFinSparseCheckoutPredecessor
		, callbackFinSparseCheckoutImplementation])
		, [...callbackFinSparseCheckoutImplementationPaths].sort());
	assert.deepEqual(names(["diff", "--name-only"
		, callbackFinSparseCheckoutPinRepair, record.integrationCommit])
		, [...callbackFinSparseCheckoutAddedPaths
			, ...callbackFinSparseCheckoutIntegrationPaths].sort());
	assert.deepEqual(record.updates.map(update => update.path)
		, callbackFinSparseCheckoutImplementationPaths);
	assert.deepEqual(record.pinUpdates.map(update => update.path), [inventoryPath]);
	assert.deepEqual(record.integrationUpdates.map(update => update.path)
		, callbackFinSparseCheckoutIntegrationPaths);
	assert.deepEqual(record.additions.map(addition => addition.path)
		, callbackFinSparseCheckoutAddedPaths);
});

test("callback Fin sparse checkout excludes publication-only bulk", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${callbackFinSparseCheckoutImplementation}:${update.path}`]);
		assert.equal(current.match(/sparse-checkout-cone-mode: false/gmu)?.length
			, 2, update.path);
		assert.equal(current.match(/!\/docs\/\*/gmu)?.length, 2, update.path);
		assert.equal(current.match(/\/docs\/consumer-support\.v1\.json/gmu)?.length
			, 2, update.path);
		assert.ok(!current.includes("/docs/evidence/"), update.path);
		assert.ok(!current.includes("/docs/type-surface.v1.json"), update.path);
	}
});

test("callback Fin sparse checkout repairs exactly its one live source pin", async () => {
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
		, `${callbackFinSparseCheckoutImplementation}:${workflowPath}`])));
});

test("callback Fin sparse checkout reverses every source endpoint", async () => {
	const record = await readRecord();
	for(const update of record.updates)
	{
		const current = git(["show"
			, `${callbackFinSparseCheckoutImplementation}:${update.path}`]);
		const previous = git(["show"
			, `${callbackFinSparseCheckoutPredecessor}:${update.path}`]);
		assert.equal(reverseCallbackFinSparseCheckoutUpdate(current, update), previous);
	}
	for(const update of record.pinUpdates)
	{
		const current = git(["show"
			, `${callbackFinSparseCheckoutPinRepair}:${update.path}`]);
		const previous = git(["show"
			, `${callbackFinSparseCheckoutImplementation}:${update.path}`]);
		assert.equal(reverseCallbackFinSparseCheckoutUpdate(current, update), previous);
	}
	for(const update of record.integrationUpdates)
	{
		const current = await sourceAtFinHistoryMilestone(update.path
			, update.currentSha256, beforeCallbackFinSparseCheckoutSource);
		const previous = git(["show"
			, `${callbackFinSparseCheckoutPinRepair}:${update.path}`]);
		assert.equal(reverseCallbackFinSparseCheckoutUpdate(current, update), previous);
		assert.equal(beforeFinRefinementSource(
			update.path, current, update.previousSha256), previous);
	}
	for(const path of callbackFinSparseCheckoutNormalizationPaths)
		assert.ok(finRefinementNormalizationPaths.includes(path));
});

test("callback Fin sparse checkout rejects altered transitions", async () => {
	const update = (await readRecord()).updates[0];
	const current = git(["show"
		, `${callbackFinSparseCheckoutImplementation}:${update.path}`]);
	for(const forged of [{ ...update, currentSha256: "0".repeat(64) }
		, { ...update, previousSha256: "0".repeat(64) }
		, { ...update, path: "unrelated.yml" }
		, { ...update, edits: [] }
		, { ...update, edits: [...update.edits, update.edits[0]] }])
		assert.throws(() => reverseCallbackFinSparseCheckoutUpdate(current, forged));
});

test("callback Fin sparse checkout writer refuses another checkout", async t => {
	const root = await mkdtemp(join(tmpdir(), "lean-callback-fin-sparse-guard-"));
	t.after(() => rm(root, { recursive: true }));
	const result = spawnSync(process.execPath, [resolve(
		"scripts/update-callback-fin-sparse-checkout-source-history.mjs"
	)], { cwd: root, encoding: "utf8", timeout: 15_000 });
	assert.notEqual(result.status, 0);
	assert.equal(result.stdout, "");
	assert.deepEqual(await readdir(root), []);
});
