/**
 * Test the retained hosted C/C++ value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexNativeEvidence
	, checkedRecordValueIndexNativeEvidence
} from "./helpers/checked-record-value-index-native-evidence.mjs";

test("hosted value-index C/C++ archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkCheckedRecordValueIndexNativeEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.ok(result.files.length > 1700);
});

test("hosted value-index C/C++ archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexNativeEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexNativeEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
