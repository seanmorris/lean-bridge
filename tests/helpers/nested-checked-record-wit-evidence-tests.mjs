/**
 * Test the immutable four-cell nested checked-record WIT/WASI evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordWitEvidence
	, nestedCheckedRecordWitEvidence
} from "./nested-checked-record-wit-evidence.mjs";
import {
	nestedCheckedRecordWitProducer
	, nestedCheckedRecordWitVerifier
} from "./nested-checked-record-wit-provenance.mjs";

test("nested checked-record WIT evidence authenticates four component selections", async () => {
	const checked = await checkNestedCheckedRecordWitEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordWitProducer);
	assert.equal(checked.checkerCommit, nestedCheckedRecordWitVerifier);
	assert.deepEqual(checked.installedProfiles, ["wit-wasi"]);
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
		assert.equal(item.counts.checks, full ? 6008 : 1553);
		assert.equal(item.counts.rejections, full ? 524 : 0);
		assert.equal(item.counts.hostRejections, full ? 7 : 4);
		assert.equal(item.counts.recoveries, full ? 256 : 0);
		assert.equal(item.counts.snapshots, full ? 1826 : 516);
		assert.equal(item.counts.rounds, 256);
		assert.equal(item.checks, full ? 12016 : 3106);
		assert.equal(item.executions, 2); assert.equal(item.loadCeiling, 20);
		assert.equal(item.records.length, item.route === "ordinary" ? 90 : 92);
		assert.equal(item.recordControls, item.records.length * 2);
		assert.equal(item.executionControls, 24);
		assert.equal(item.toolControls, 12);
		assert.equal(item.resourceControls, 7);
		assert.equal(item.environmentControls, 15);
		assert.equal(item.packageControls, 5);
		assert.equal(item.modelControls, full ? 6 : 5);
		assert.equal(item.nativeHostRequired, true);
		assert.equal(item.standaloneWasi, false);
	}
});

test("nested checked-record WIT evidence rejects a changed record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNestedCheckedRecordWitEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordWitEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record WIT evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNestedCheckedRecordWitEvidence(readFile, {
		controls: "some"
	}));
});
