/**
 * Test the retained hosted zero-payload C/C++ archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkZeroPayloadNativeEvidence, zeroPayloadNativeEvidence
} from "./helpers/zero-payload-checked-record-native-evidence.mjs";

test("hosted zero-payload C/C++ archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkZeroPayloadNativeEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.ok(result.files.length > 1800);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/analyze/NativeExports.lean"
	, "hosted/artifact.zip.parts/0006.part"
]) test(`hosted zero-payload C/C++ archive rejects changed ${target}`, async () => {
	await assert.rejects(checkZeroPayloadNativeEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${zeroPayloadNativeEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
