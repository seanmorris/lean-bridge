/**
 * Test the immutable four-selection primitive-base nominal Rust archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNominalPrimitiveSubtypeRustEvidence
	, nominalPrimitiveSubtypeRustEvidence
} from "./nominal-primitive-subtype-rust-evidence.mjs";
import { nominalPrimitiveSubtypeRustProducer } from "./nominal-primitive-subtype-rust-provenance.mjs";

test("primitive-base Rust evidence authenticates four installed selections and the interrupted launch", async () => {
	const checked = await checkNominalPrimitiveSubtypeRustEvidence();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeRustProducer);
	assert.deepEqual(checked.installedProfiles, ["rust"]); assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative"); assert.equal(checked.files.length, 890); assert.equal(checked.selectedSources.length, 548);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode, item.attempt]), [
		["ordinary", "full", "r2"], ["ordinary", "result-only", "r1"]
		, ["reviewed", "full", "r1"], ["reviewed", "result-only", "r1"]
	]);
	for(const item of checked.selections)
	{
		assert.equal(item.counts.checks, item.mode === "full" ? 1332 : 601);
		assert.equal(item.counts.rejections, item.mode === "full" ? 306 : 0);
		assert.equal(item.counts.snapshotControls, 30); assert.equal(item.counts.rounds, 256); assert.equal(item.counts.wordBits, 64);
		assert.equal(item.executions, 3); assert.equal(item.generatorModules, 21); assert.equal(item.dispatchObserved, false);
		assert.equal(item.recordControls, item.records * 2);
		assert.equal(item.environmentControls, item.mode === "full" ? 60 : 61); assert.equal(item.packageControls, 6);
		assert.equal(item.modelControls, item.mode === "full" ? 42 : 23); assert.equal(item.executionControls, 30);
		assert.equal(item.loadCeiling, 8);
	}
	assert.equal(checked.preserved.length, 1); assert.equal(checked.preserved[0].counted, false);
});

test("primitive-base Rust evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNominalPrimitiveSubtypeRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypeRustEvidence}/${target}` ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base Rust evidence rejects a changed archive index", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypeRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypeRustEvidence}/index.json` ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base Rust evidence admits only the frozen control scopes", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypeRustEvidence(readFile, { controls: "some" }));
});
