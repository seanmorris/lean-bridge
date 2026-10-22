/**
 * Test the retained hosted WIT dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordWitEvidence
	, dependentCheckedRecordWitEvidence
} from "./dependent-checked-record-wit-evidence.mjs";

test("hosted dependent WIT archive authenticates every retained route", {
	timeout: 300_000
}, async () => {
	const result = await checkDependentCheckedRecordWitEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1205);
	assert.equal(result.hostedRun.artifact.id, 12468135063);
	assert.equal(result.hostedRun.artifact.members.length, 374);
	assert.equal(result.runtime.glibc, "2.39");
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/checker/scripts/check-dependent-checked-record-wit-ci.mjs"
	, "hosted/logs/toolchain.log"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted dependent WIT archive rejects changed ${target}`, {
	timeout: 300_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordWitEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${dependentCheckedRecordWitEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}
	));
});
