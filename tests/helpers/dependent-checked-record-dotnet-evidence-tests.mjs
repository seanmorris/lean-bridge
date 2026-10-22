/**
 * Test the retained hosted .NET dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordDotnetEvidence
	, dependentCheckedRecordDotnetEvidence
} from "./dependent-checked-record-dotnet-evidence.mjs";

test("hosted dependent .NET archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordDotnetEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 808);
	assert.equal(result.hostedRun.artifact.id, 12460139373);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/build/native-dotnet-artifacts.mjs"
	, "hosted/artifact.zip.parts/0000.part"
]) test(`hosted dependent .NET archive rejects changed ${target}`, {
	timeout: 180_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordDotnetEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordDotnetEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
