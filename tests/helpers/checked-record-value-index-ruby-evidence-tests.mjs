/**
 * Test the retained hosted Ruby value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexRubyEvidence
	, checkedRecordValueIndexRubyEvidence
} from "./checked-record-value-index-ruby-evidence.mjs";
import "./checked-record-value-index-ruby-archive-source-history-tests.mjs";
import "./checked-record-value-index-ruby-promotion-tests.mjs";
import "./checked-record-value-index-ruby-promotion-source-history-tests.mjs";

test("hosted value-index Ruby archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkCheckedRecordValueIndexRubyEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.ok(result.files.length > 1700);
});

test("hosted value-index Ruby archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexRubyEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexRubyEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});

test("hosted value-index Ruby archive rejects a changed original ZIP part", async () => {
	const target = "hosted/artifact.zip.parts/0001.part";
	await assert.rejects(checkCheckedRecordValueIndexRubyEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexRubyEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	}));
});
