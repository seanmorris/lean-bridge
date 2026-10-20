/**
 * Test the retained hosted WIT/WASI value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexWitEvidence
	, checkedRecordValueIndexWitEvidence
} from "./checked-record-value-index-wit-evidence.mjs";
import "./checked-record-value-index-wit-archive-source-history-tests.mjs";
import "./checked-record-value-index-wit-promotion-tests.mjs";

test("hosted value-index WIT archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkCheckedRecordValueIndexWitEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 2036);
	assert.equal(result.hostedRun.artifact.id, 12243086792);
});

test("hosted value-index WIT archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexWitEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexWitEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});

test("hosted value-index WIT archive rejects a changed original ZIP part", async () => {
	const target = "hosted/artifact.zip.parts/0000.part";
	await assert.rejects(checkCheckedRecordValueIndexWitEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexWitEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	}));
});
