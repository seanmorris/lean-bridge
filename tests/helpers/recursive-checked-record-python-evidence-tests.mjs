/**
 * Test the immutable four-selection recursive Python evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkRecursiveCheckedRecordPythonEvidence, recursiveCheckedRecordPythonEvidence
} from "./recursive-checked-record-python-evidence.mjs";
import {
	recursiveCheckedRecordPythonProducer, recursiveCheckedRecordPythonVerifier
} from "./recursive-checked-record-python-provenance.mjs";

test("recursive checked-record Python evidence authenticates four wheel selections", async () => {
	const checked = await checkRecursiveCheckedRecordPythonEvidence();
	assert.equal(checked.producerCommit, recursiveCheckedRecordPythonProducer);
	assert.equal(checked.checkerCommit, recursiveCheckedRecordPythonVerifier);
	assert.deepEqual(checked.installedProfiles, ["python"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => [item.route, item.fixture]), [
		["ordinary", "recursive"], ["ordinary", "mutual"]
		, ["reviewed", "recursive"], ["reviewed", "mutual"]
	]);
	for(const item of checked.selections)
	{
		const mutual = item.fixture === "mutual";
		assert.equal(item.executions, 6);
		assert.equal(item.counts.checks * item.executions, mutual ? 6_600 : 6_498);
		assert.equal(item.counts.rejections * item.executions, 864);
		assert.equal(item.counts.hostRejections * item.executions, mutual ? 480 : 468);
		assert.equal(item.counts.recoveries * item.executions, 384);
		assert.equal(item.records, item.route === "reviewed" ? 75 : 73);
		assert.equal(item.recordControls, item.records * 2); assert.equal(item.resourceControls, 8);
		assert.equal(item.modelControls, 7); assert.equal(item.environmentControls, 33);
		assert.equal(item.packageControls, 3);
	}
});

test("recursive checked-record Python evidence rejects a changed record or source", async () => {
	for(const target of ["ordinary-mutual/records/report.json", "producer/run.tap"
		, "sources/producer/tests/fixtures/recursive-checked-record-consumers/python.py"]) {
		await assert.rejects(checkRecursiveCheckedRecordPythonEvidence(async path => {
			const bytes = await readFile(path);
			return path === `${recursiveCheckedRecordPythonEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}), undefined, target);
		}
});

test("recursive checked-record Python evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkRecursiveCheckedRecordPythonEvidence(readFile, { controls: "some" }));
});
