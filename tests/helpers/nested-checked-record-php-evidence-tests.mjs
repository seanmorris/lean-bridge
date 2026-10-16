/**
 * Test the immutable four-cell native PHP evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordPhpEvidence
	, nestedCheckedRecordPhpEvidence
} from "./nested-checked-record-php-evidence.mjs";
import {
	nestedCheckedRecordPhpProducer
	, nestedCheckedRecordPhpVerifier
} from "./nested-checked-record-php-provenance.mjs";

test("nested checked-record native PHP evidence authenticates four Composer selections", async () => {
	const checked = await checkNestedCheckedRecordPhpEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordPhpProducer);
	assert.equal(checked.checkerCommit, nestedCheckedRecordPhpVerifier);
	assert.deepEqual(checked.installedProfiles, ["php-native"]);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative");
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.equal(item.checks, full ? 14820 : 4240);
		assert.equal(item.rejections, full ? 2100 : 0);
		assert.equal(item.hostRejections, full ? 64 : 24);
		assert.equal(item.recoveries, full ? 1024 : 0);
		assert.equal(item.snapshots, full ? 7360 : 2080);
		assert.equal(item.executions, 4); assert.equal(item.loadCeiling, 20);
		assert.equal(item.recordControls, item.records.length * 2);
		assert.equal(item.executionControls, 48); assert.equal(item.toolControls, 12);
		assert.equal(item.resourceControls, 7); assert.equal(item.environmentControls, 10);
		assert.equal(item.packageControls, 4); assert.equal(item.modelControls, full ? 7 : 6);
	}
});

test("nested checked-record native PHP evidence rejects a changed record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNestedCheckedRecordPhpEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordPhpEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record native PHP evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNestedCheckedRecordPhpEvidence(readFile, {
		controls: "some"
	}));
});
