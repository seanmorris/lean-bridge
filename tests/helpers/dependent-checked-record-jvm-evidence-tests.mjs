/**
 * Test the retained hosted Java/Kotlin dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordJvmEvidence
	, dependentCheckedRecordJvmEvidence
} from "./dependent-checked-record-jvm-evidence.mjs";

test("hosted dependent JVM archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordJvmEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 938);
	assert.equal(result.hostedRun.artifact.id, 12389961820);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/analyze/NativeExports.lean"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted dependent JVM archive rejects changed ${target}`, {
	timeout: 180_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordJvmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordJvmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
