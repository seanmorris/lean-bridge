/**
 * Test the immutable four-selection primitive-base nominal native PHP archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNominalPrimitiveSubtypePhpEvidence
	, nominalPrimitiveSubtypePhpEvidence
} from "./nominal-primitive-subtype-php-evidence.mjs";
import { nominalPrimitiveSubtypePhpProducer } from "./nominal-primitive-subtype-php-provenance.mjs";

test("primitive-base native PHP evidence authenticates four installed Composer selections", async () => {
	const checked = await checkNominalPrimitiveSubtypePhpEvidence();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypePhpProducer);
	assert.deepEqual(checked.installedProfiles, ["php-native"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative"); assert.equal(checked.files.length, 805);
	assert.equal(checked.selectedSources.length, 529);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.equal(item.counts.checks, full ? 1821 : 612);
		assert.equal(item.counts.rejections, full ? 283 : 0);
		assert.equal(item.counts.hostRejections, 8); assert.equal(item.counts.snapshotControls, 12);
		assert.equal(item.counts.rounds, 256); assert.equal(item.counts.wordBits, 64);
		assert.equal(item.executions, 4); assert.equal(item.generatorPaths.length, 22);
		assert.equal(item.dispatchObserved, false); assert.equal(item.recordControls, item.records.length * 2);
		assert.equal(item.environmentControls, 10); assert.equal(item.packageControls, 4);
		assert.equal(item.modelControls, full ? 6 : 5); assert.equal(item.executionControls, 40);
		assert.equal(item.toolControls, 12); assert.equal(item.resourceControls, 4);
		assert.equal(item.loadCeiling, 8);
	}
});

test("primitive-base native PHP evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNominalPrimitiveSubtypePhpEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypePhpEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base native PHP evidence rejects a changed archive index", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypePhpEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypePhpEvidence}/index.json`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base native PHP evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypePhpEvidence(readFile, { controls: "some" }));
});
