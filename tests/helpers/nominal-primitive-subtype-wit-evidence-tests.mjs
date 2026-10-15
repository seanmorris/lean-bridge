/**
 * Test the immutable four-selection nineteen-base nominal WIT archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNominalPrimitiveSubtypeWitEvidence
	, nominalPrimitiveSubtypeWitEvidence
} from "./nominal-primitive-subtype-wit-evidence.mjs";
import { nominalPrimitiveSubtypeWitFirstProducer, nominalPrimitiveSubtypeWitProducer } from "./nominal-primitive-subtype-wit-provenance.mjs";

test("primitive-base WIT evidence authenticates four serial installed selections and the preserved first launch", async () => {
	const checked = await checkNominalPrimitiveSubtypeWitEvidence();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeWitProducer);
	assert.deepEqual(checked.installedProfiles, ["wit-wasi"]); assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode, item.attempt]), [
		["ordinary", "full", "r1"], ["ordinary", "result-only", "r1"]
		, ["reviewed", "full", "r1"], ["reviewed", "result-only", "r1"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.deepEqual(item.counts, { checks: full ? 3114 : 5584, rejections: full ? 308 : 0, hostRejections: full ? 22 : 14, snapshotControls: 22, rounds: 256, wordBits: 64 });
		assert.equal(item.executions, 2); assert.equal(item.dispatchObserved, false);
		assert.equal(item.wasmtime, "42.0.1"); assert.equal(item.nativeHostRequired, true); assert.equal(item.standaloneWasi, false);
		assert.equal(item.controls.recordControls, item.records.length * 2); assert.equal(item.controls.executionControls, 24);
		assert.equal(item.controls.toolControls, 12); assert.equal(item.controls.resourceControls, 4);
		assert.equal(item.controls.environmentControls, 15); assert.equal(item.controls.packageControls, 5);
		assert.equal(item.controls.modelControls, full ? 6 : 5);
	}
	assert.equal(checked.preserved.length, 1); assert.equal(checked.preserved[0].counted, false);
	assert.equal(checked.preserved[0].revision, nominalPrimitiveSubtypeWitFirstProducer);
	assert.equal(checked.preserved[0].producerCode, 0); assert.equal(checked.preserved[0].controlsCode, 1);
});

test("primitive-base WIT evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNominalPrimitiveSubtypeWitEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypeWitEvidence}/${target}` ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
