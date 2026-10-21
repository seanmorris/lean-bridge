/**
 * Test the retained hosted Python dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordPythonEvidence
	, dependentCheckedRecordPythonEvidence
} from "./dependent-checked-record-python-evidence.mjs";

test("hosted dependent Python archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordPythonEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1475);
	assert.equal(result.hostedRun.artifact.id, 12386335597);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/analyze/NativeExports.lean"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted dependent Python archive rejects changed ${target}`, {
	timeout: 180_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordPythonEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordPythonEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
