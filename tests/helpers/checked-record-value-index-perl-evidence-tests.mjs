/**
 * Test the retained hosted Perl value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexPerlEvidence
	, checkedRecordValueIndexPerlEvidence
} from "./checked-record-value-index-perl-evidence.mjs";
import "./checked-record-value-index-perl-archive-source-history-tests.mjs";
import "./checked-record-value-index-perl-archive-history-gap-source-history-tests.mjs";
import "./checked-record-value-index-perl-promotion-tests.mjs";
import "./checked-record-value-index-perl-promotion-source-history-tests.mjs";

test("hosted value-index Perl archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkCheckedRecordValueIndexPerlEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.interpreters.length, 4);
	assert.ok(result.files.length > 2100);
});

test("hosted value-index Perl archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/5.36.3-threaded/build-xs/component-install-receipt.json";
	await assert.rejects(checkCheckedRecordValueIndexPerlEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexPerlEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});

test("hosted value-index Perl archive rejects a changed index before reading records", async () => {
	await assert.rejects(checkCheckedRecordValueIndexPerlEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexPerlEvidence}/index.json`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
