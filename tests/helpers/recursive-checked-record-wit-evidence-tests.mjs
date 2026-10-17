/**
 * Test the immutable four-selection recursive checked-record WIT evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson } from "../../src/capsule/node.mjs";
import {
	checkRecursiveCheckedRecordWitEvidence, recursiveCheckedRecordWitEvidence
} from "./recursive-checked-record-wit-evidence.mjs";
import {
	recursiveCheckedRecordWitProducer, recursiveCheckedRecordWitVerifier
} from "./recursive-checked-record-wit-provenance.mjs";

test("recursive checked-record WIT evidence authenticates four component selections and both refusals", async () => {
	const checked = await checkRecursiveCheckedRecordWitEvidence();
	assert.equal(checked.producerCommit, recursiveCheckedRecordWitProducer);
	assert.equal(checked.checkerCommit, recursiveCheckedRecordWitVerifier);
	assert.deepEqual(checked.installedProfiles, ["wit-wasi"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => [item.route, item.fixture, item.attempt]), [
		["ordinary", "recursive", "r2"], ["reviewed", "recursive", "r2"]
		, ["ordinary", "mutual", "r2"], ["reviewed", "mutual", "r3"]
	]);
	for(const item of checked.selections)
	{
		const mutual = item.fixture === "mutual";
		assert.equal(item.executions, 2); assert.equal(item.exactDiagnostics, true);
		assert.equal(item.checks, mutual ? 2_158 : 2_136); assert.equal(item.rejections, 288);
		assert.equal(item.hostRejections, mutual ? 152 : 150); assert.equal(item.recoveries, 128);
		assert.equal(item.records.length, item.route === "reviewed" ? 93 : 91);
		assert.equal(item.recordControls, item.records.length * 2 + 4);
		assert.equal(item.transportControls, 5); assert.equal(item.modelControls, 10);
	}
	assert.deepEqual(checked.refusals.map(item => [item.attempt, item.label]), [["r1", "ordinary-recursive"], ["r2", "reviewed-mutual"]]);
});

test("recursive checked-record WIT evidence rejects changed records, sources, refusals and runners", async () => {
	const targets = ["ordinary-mutual/records/report.json"
		, "reviewed-mutual/run.tap", "ordinary-recursive/verification.json"
		, "refusals/r1-ordinary-recursive/run.tap", "producer/runners/r3.sh"
		, "sources/producer/tests/fixtures/recursive-checked-record-consumers/wit-wasi.c"];
	for(const target of targets)
		await assert.rejects(checkRecursiveCheckedRecordWitEvidence(async path => {
			const bytes = await readFile(path);
			return path === `${recursiveCheckedRecordWitEvidence}/${target}` ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}, { controls: "none" }), undefined, target);
	// A re-signed index cannot claim acceptance for a refused attempt.
	const index = JSON.parse(await readFile(`${recursiveCheckedRecordWitEvidence}/index.json`));
	index.runs[3].attempt = "r2";
	await assert.rejects(checkRecursiveCheckedRecordWitEvidence(async path => path === `${recursiveCheckedRecordWitEvidence}/index.json`
		? Buffer.from(canonicalJson(index)) : readFile(path), { controls: "none" }));
});

test("recursive checked-record WIT evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkRecursiveCheckedRecordWitEvidence(readFile, { controls: "some" }));
});
