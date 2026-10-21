/**
 * Test the retained hosted Perl dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordPerlEvidence
	, dependentCheckedRecordPerlEvidence
} from "./dependent-checked-record-perl-evidence.mjs";

test("hosted dependent Perl archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordPerlEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1493);
	assert.equal(result.hostedRun.artifact.id, 12379110462);
});

test("hosted dependent Perl archive rejects a changed retained record"
	, async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkDependentCheckedRecordPerlEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordPerlEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));}
);

test("hosted dependent Perl archive rejects a changed original ZIP part"
	, async () => {
	const target = "hosted/artifact.zip.parts/0000.part";
	await assert.rejects(checkDependentCheckedRecordPerlEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordPerlEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	}));}
);
