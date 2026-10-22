/**
 * Test the retained hosted C/C++ dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordNativeEvidence
	, dependentCheckedRecordNativeEvidence
} from "./dependent-checked-record-native-evidence.mjs";

test("hosted dependent native archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordNativeEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 817);
	assert.equal(result.hostedRun.artifact.id, 12462052085);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/checker/tests/helpers/dependent-checked-record-native-report.mjs"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted dependent native archive rejects changed ${target}`, {
	timeout: 180_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordNativeEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordNativeEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
