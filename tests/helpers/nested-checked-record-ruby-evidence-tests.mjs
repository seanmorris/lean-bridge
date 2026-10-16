/**
 * Test the immutable four-cell nested checked-record Ruby evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordRubyEvidence
	, nestedCheckedRecordRubyEvidence
} from "./nested-checked-record-ruby-evidence.mjs";
import {
	nestedCheckedRecordRubyProducer
	, nestedCheckedRecordRubyVerifier
} from "./nested-checked-record-ruby-provenance.mjs";

test("nested checked-record Ruby evidence authenticates four gem selections", async () => {
	const checked = await checkNestedCheckedRecordRubyEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordRubyProducer);
	assert.equal(checked.checkerCommit, nestedCheckedRecordRubyVerifier);
	assert.deepEqual(checked.installedProfiles, ["ruby"]);
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
		assert.equal(item.counts.checks, full ? 5002 : 1571);
		assert.equal(item.counts.rejections, full ? 525 : 0);
		assert.equal(item.counts.hostRejections, full ? 15 : 4);
		assert.equal(item.counts.recoveries, full ? 256 : 0);
		assert.equal(item.counts.snapshots, full ? 1839 : 518);
		assert.equal(item.counts.snapshotControls, full ? 12 : 8);
		assert.equal(item.counts.rounds, 256);
		assert.equal(item.executions, 2); assert.equal(item.loadCeiling, 20);
		assert.equal(item.records, item.route === "ordinary" ? 47 : 49);
		assert.equal(item.recordControls, item.records * 2);
		assert.equal(item.resourceControls, 7);
		assert.equal(item.environmentControls, 12);
		assert.equal(item.packageControls, 4);
		assert.equal(item.modelControls, full ? 6 : 5);
		assert.equal(item.executionControls, 20);
	}
});

test("nested checked-record Ruby evidence rejects a changed record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNestedCheckedRecordRubyEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordRubyEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record Ruby evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNestedCheckedRecordRubyEvidence(readFile, {
		controls: "some"
	}));
});
