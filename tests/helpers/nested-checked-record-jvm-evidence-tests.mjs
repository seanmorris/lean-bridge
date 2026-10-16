/**
 * Test the immutable four-selection nested checked-record JVM archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordJvmEvidence
	, nestedCheckedRecordJvmEvidence
} from "./nested-checked-record-jvm-evidence.mjs";
import { nestedCheckedRecordJvmProducer } from "./nested-checked-record-jvm-provenance.mjs";

test("nested checked-record JVM evidence authenticates four installed Maven selections", async () => {
	const checked = await checkNestedCheckedRecordJvmEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordJvmProducer);
	assert.deepEqual(checked.installedProfiles, ["java", "kotlin"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative");
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.equal(item.checks, full ? 23544 : 7740);
		assert.equal(item.rejections, full ? 3144 : 0);
		assert.equal(item.hostRejections, full ? 42 : 24);
		assert.equal(item.recoveries, full ? 3168 : 6);
		assert.equal(item.snapshots, full ? 6324 : 6);
		assert.equal(item.executions, 6); assert.equal(item.loadCeiling, 12);
		assert.equal(item.recordControls, item.records.length * 2);
		assert.equal(item.executionControls, 48); assert.equal(item.probeControls, 22);
		assert.equal(item.packageControls, 4); assert.equal(item.modelControls, full ? 5 : 4);
		assert.equal(item.resourceControls, 8);
	}
});

test("nested checked-record JVM evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNestedCheckedRecordJvmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordJvmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record JVM evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNestedCheckedRecordJvmEvidence(readFile, { controls: "some" }));
});
