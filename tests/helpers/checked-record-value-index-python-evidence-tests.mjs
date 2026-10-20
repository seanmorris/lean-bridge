/**
 * Test the retained hosted Python value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexPythonEvidence
	, checkedRecordValueIndexPythonEvidence
} from "./checked-record-value-index-python-evidence.mjs";
import "./checked-record-value-index-python-archive-source-history-tests.mjs";

test("hosted value-index Python archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkCheckedRecordValueIndexPythonEvidence();
	assert.equal(result.hostedAcceptance, true); assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4); assert.equal(result.packages.length, 4);
	assert.ok(result.files.length > 1400);
});

test("hosted value-index Python archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexPythonEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexPythonEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});

test("hosted value-index Python archive rejects a changed original ZIP part", async () => {
	const target = "hosted/artifact.zip.parts/0003.part";
	await assert.rejects(checkCheckedRecordValueIndexPythonEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexPythonEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	}));
});
