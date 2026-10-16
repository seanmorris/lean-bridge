/**
 * Test the immutable four-cell Python evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordPythonEvidence
	, nestedCheckedRecordPythonEvidence
} from "./nested-checked-record-python-evidence.mjs";
import {
	nestedCheckedRecordPythonProducer
	, nestedCheckedRecordPythonVerifier
} from "./nested-checked-record-python-provenance.mjs";

test("nested checked-record Python evidence authenticates four wheel selections", async () => {
	const checked = await checkNestedCheckedRecordPythonEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordPythonProducer);
	assert.equal(checked.checkerCommit, nestedCheckedRecordPythonVerifier);
	assert.deepEqual(checked.installedProfiles, ["python"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative");
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.equal(item.counts.checks * item.executions, full ? 14_816 : 4_228);
		assert.equal(item.counts.rejections * item.executions, full ? 2_100 : 0);
		assert.equal(item.counts.hostRejections * item.executions, full ? 60 : 16);
		assert.equal(item.counts.recoveries * item.executions, full ? 1_024 : 0);
		assert.equal(item.counts.snapshots * item.executions, full ? 7_360 : 2_072);
		assert.equal(item.executions, 4); assert.equal(item.loadCeiling, 20);
		assert.equal(item.recordControls, item.records * 2); assert.equal(item.resourceControls, 7);
		assert.equal(item.environmentControls, 44); assert.equal(item.packageControls, 4);
		assert.equal(item.modelControls, full ? 6 : 5);
	}
});

test("nested checked-record Python evidence rejects a changed record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNestedCheckedRecordPythonEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordPythonEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record Python evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNestedCheckedRecordPythonEvidence(readFile, { controls: "some" }));
});
