/**
 * Test the retained hosted Ruby dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordRubyEvidence
	, dependentCheckedRecordRubyEvidence
} from "./dependent-checked-record-ruby-evidence.mjs";

test("hosted dependent Ruby archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordRubyEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1431);
	assert.equal(result.hostedRun.artifact.id, 12379914820);
});

test("hosted dependent Ruby archive rejects a changed retained record"
	, async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkDependentCheckedRecordRubyEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordRubyEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));}
);

test("hosted dependent Ruby archive rejects a changed original ZIP part"
	, async () => {
	const target = "hosted/artifact.zip.parts/0000.part";
	await assert.rejects(checkDependentCheckedRecordRubyEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordRubyEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	}));}
);
