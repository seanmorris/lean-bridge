/**
 * Test the retained hosted Java/Kotlin value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexJvmEvidence
	, checkedRecordValueIndexJvmEvidence
} from "./helpers/checked-record-value-index-jvm-evidence.mjs";

test("hosted value-index Java and Kotlin archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkCheckedRecordValueIndexJvmEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.ok(result.files.length > 1700);
});

test("hosted value-index Java and Kotlin archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexJvmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexJvmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
