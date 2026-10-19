/**
 * Test the retained hosted native-PHP value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexPhpEvidence
	, checkedRecordValueIndexPhpEvidence
} from "./checked-record-value-index-php-evidence.mjs";

test("hosted value-index native-PHP archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkCheckedRecordValueIndexPhpEvidence();
	assert.equal(result.hostedAcceptance, true); assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4); assert.equal(result.controls.length, 4);
	assert.ok(result.files.length > 1400);
});

test("hosted value-index native-PHP archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexPhpEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexPhpEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
