/**
 * Test the immutable four-selection recursive Ruby evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkRecursiveCheckedRecordRubyEvidence, recursiveCheckedRecordRubyEvidence
} from "./recursive-checked-record-ruby-evidence.mjs";
import {
	recursiveCheckedRecordRubyProducer, recursiveCheckedRecordRubyVerifier
} from "./recursive-checked-record-ruby-provenance.mjs";

test("recursive checked-record Ruby evidence authenticates four gem selections", async () => {
	const checked = await checkRecursiveCheckedRecordRubyEvidence();
	assert.equal(checked.producerCommit, recursiveCheckedRecordRubyProducer);
	assert.equal(checked.checkerCommit, recursiveCheckedRecordRubyVerifier);
	assert.deepEqual(checked.installedProfiles, ["ruby"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => [item.route, item.fixture]), [
		["ordinary", "recursive"], ["ordinary", "mutual"]
		, ["reviewed", "recursive"], ["reviewed", "mutual"]
	]);
	for(const item of checked.selections)
	{
		const mutual = item.fixture === "mutual";
		assert.equal(item.executions, 2);
		assert.equal(item.counts.checks * item.executions, mutual ? 2_200 : 2_166);
		assert.equal(item.counts.rejections * item.executions, 288);
		assert.equal(item.counts.hostRejections * item.executions, mutual ? 160 : 156);
		assert.equal(item.counts.recoveries * item.executions, 128);
		assert.equal(item.records, item.route === "reviewed" ? 52 : 50);
		assert.equal(item.recordControls, item.records * 2); assert.equal(item.resourceControls, 7);
		assert.equal(item.modelControls, 7); assert.equal(item.environmentControls, 12);
		assert.equal(item.packageControls, 4); assert.equal(item.executionControls, 20);
	}
});

test("recursive checked-record Ruby evidence rejects a changed record or source", async () => {
	const targets = ["ordinary-mutual/records/report.json", "producer/run.tap"
		, "sources/producer/tests/fixtures/recursive-checked-record-consumers/ruby.rb"];
	for(const target of targets)
	{
		await assert.rejects(checkRecursiveCheckedRecordRubyEvidence(async path => {
			const bytes = await readFile(path);
			return path === `${recursiveCheckedRecordRubyEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}), undefined, target);
	}
});

test("recursive checked-record Ruby evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkRecursiveCheckedRecordRubyEvidence(readFile, { controls: "some" }));
});
