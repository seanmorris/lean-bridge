/**
 * Require the native compiler repair without weakening historical evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { sha256 } from "../src/capsule/node.mjs";
import { assertOwnedZendBailoutExecution } from "./helpers/owned-zend-bailout-repair-evidence.mjs";
import { beforeOwnedZendBailoutRepair, ownedZendBailoutAddedPaths, ownedZendBailoutBaseline
	, ownedZendBailoutChangedPaths, ownedZendBailoutHistoryPath, ownedZendBailoutPrevious
	, reverseOwnedZendBailoutUpdate } from "./helpers/owned-zend-bailout-repair-history.mjs";

const read = async () => JSON.parse(await readFile(ownedZendBailoutHistoryPath, "utf8"));

test("Zend bailout repair binds all current sources and leaves production and prior receipts unchanged", async () => {
	const record = await read();
	assert.equal(record.schemaVersion, 1); assert.equal(record.kind, "owned-zend-bailout-repair");
	assert.equal(record.planNode, 1219); assert.equal(record.baselineRevision, ownedZendBailoutBaseline);
	assert.deepEqual(record.previous, ownedZendBailoutPrevious);
	const bytes = await readFile(record.previous.path), previous = JSON.parse(bytes);
	assert.equal(sha256(bytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), [...new Set([...Object.keys(previous.sources), ...ownedZendBailoutAddedPaths])].sort());
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.deepEqual(record.updates.map(update => update.path), ownedZendBailoutChangedPaths);
	for(const update of record.updates)
	{
		assert.equal(update.previousSha256, previous.sources[update.path], update.path);
		assert.equal(update.currentSha256, record.sources[update.path], update.path);
		const current = await readFile(update.path, "utf8"), prior = beforeOwnedZendBailoutRepair(update.path, current);
		assert.equal(sha256(prior), update.previousSha256);
		assert.equal(beforeOwnedZendBailoutRepair(update.path, prior), prior);
		assert.equal(beforeOwnedZendBailoutRepair(update.path, current, update.currentSha256), current);
		const unknown = current + "\n/* unrecorded bailout repair */\n";
		assert.equal(beforeOwnedZendBailoutRepair(update.path, unknown), unknown);
		assert.throws(() => reverseOwnedZendBailoutUpdate(unknown, update));
		for(const changed of [{ ...update, previousSha256: "0".repeat(64) }, { ...update, path: "unknown.mjs" }, { ...update, edits: [...update.edits, update.edits[0]] }])
			assert.throws(() => reverseOwnedZendBailoutUpdate(current, changed));
	}
	for(const path of Object.keys(previous.sources).filter(path => path.startsWith("src/") && path !== "src/adoption/test-profiles.mjs"))
		assert.equal(record.sources[path], previous.sources[path], "No production changes: " + path);
	const current = await readFile("docs/type-surface.v1.json", "utf8");
	const prior = JSON.parse(beforeOwnedZendBailoutRepair("docs/type-surface.v1.json", current));
	for(const evidence of prior.evidence) for(const file of evidence.files) file.sha256 = sha256(await readFile(file.path));
	assert.deepEqual(JSON.parse(current), prior, "The repair must not promote installed support");
});

test("Zend bailout repair requires native GCC12/GCC13 and actual wasm32 cleanup execution", async () => {
	await assertOwnedZendBailoutExecution(await read());
});

test("Zend bailout repair rejects skipped checks, missing aborts and weakened lifetime claims", async () => {
	const original = await read();
	const rewrite = (record, before, after) => {
		const run = record.runs.execution, text = run.text.replace(before, after);
		assert.notEqual(text, run.text); run.text = text; run.sha256 = sha256(text);
	};
	for(const mutate of [
		record => { record.scope.productionUnchanged = false; }
		, record => { record.scope.installedSupportPromotions = 1; }
		, record => { record.runs.before.exitCode = 0; }
		, record => { delete record.runs.gcc12; }
		, record => { record.runs.execution.text += "changed"; }
		, record => rewrite(record, "# skipped 0", "# skipped 1")
		, record => rewrite(record, '"compilerVersion":"cc (GCC) 13.', '"compilerVersion":"cc (GCC) 12.')
		, record => rewrite(record, '"fiberExecution":true', '"fiberExecution":false')
		, record => rewrite(record, '"mode":6', '"mode":0')
		, record => rewrite(record, '"live":0', '"live":1')
		, record => rewrite(record, '"borrowRetain":8', '"borrowRetain":0')
		, record => rewrite(record, '"missing-fiber-guard"', '"missing-case"')
	]) {
		const changed = structuredClone(original); mutate(changed);
		await assert.rejects(() => assertOwnedZendBailoutExecution(changed), mutate.toString());
	}
});
