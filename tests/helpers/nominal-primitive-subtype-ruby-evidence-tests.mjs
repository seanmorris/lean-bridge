/**
 * Test the immutable four-selection primitive-base nominal Ruby archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNominalPrimitiveSubtypeRubyEvidence
	, nominalPrimitiveSubtypeRubyEvidence
} from "./nominal-primitive-subtype-ruby-evidence.mjs";
import { nominalPrimitiveSubtypeRubyProducer } from "./nominal-primitive-subtype-ruby-provenance.mjs";

test("primitive-base Ruby evidence authenticates four serial installed selections and the failed launch", async () => {
	const checked = await checkNominalPrimitiveSubtypeRubyEvidence();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeRubyProducer);
	assert.deepEqual(checked.installedProfiles, ["ruby"]); assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode, item.attempt]), [
		["ordinary", "full", "r2"], ["ordinary", "result-only", "r1"]
		, ["reviewed", "full", "r1"], ["reviewed", "result-only", "r1"]
	]);
	for(const item of checked.selections)
	{
		assert.equal(item.counts.checks, item.mode === "full" ? 1664 : 875);
		assert.equal(item.counts.rejections, item.mode === "full" ? 306 : 0);
		assert.equal(item.counts.snapshotControls, 12); assert.equal(item.counts.rounds, 256); assert.equal(item.counts.wordBits, 64);
		assert.equal(item.executions, 2); assert.equal(item.generatorModules, 19); assert.equal(item.dispatchObserved, false);
		assert.equal(item.recordControls, item.records * 2); assert.equal(item.environmentControls, 12); assert.equal(item.packageControls, 4);
		assert.equal(item.modelControls, item.mode === "full" ? 42 : 23); assert.equal(item.executionControls, 20);
		assert.equal(item.loadCeiling, 8);
	}
	assert.equal(checked.preserved.length, 1); assert.equal(checked.preserved[0].counted, false);
	assert.equal(checked.preserved[0].stopReason, "disk-floor");
});

test("primitive-base Ruby evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNominalPrimitiveSubtypeRubyEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypeRubyEvidence}/${target}` ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
