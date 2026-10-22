/**
 * Test the retained hosted native-PHP dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordPhpEvidence
	, dependentCheckedRecordPhpEvidence
} from "./dependent-checked-record-php-evidence.mjs";

test("hosted dependent native-PHP archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordPhpEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1008);
	assert.equal(result.hostedRun.artifact.id, 12463338839);
	assert.equal(result.runtime.glibc, "2.39");
	assert.equal(result.tools.selected.phpVersion, "8.3.6");
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/backends/php/copied-values.mjs"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted dependent native-PHP archive rejects changed ${target}`, {
	timeout: 180_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordPhpEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordPhpEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
