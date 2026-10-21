/**
 * Test the retained hosted zero-payload WIT archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkZeroPayloadWitEvidence, zeroPayloadWitEvidence
} from "./helpers/zero-payload-checked-record-wit-evidence.mjs";

test("hosted zero-payload WIT archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkZeroPayloadWitEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 2117);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/analyze/NativeExports.lean"
	, "hosted/artifact.zip.parts/0003.part"
]) test(`hosted zero-payload WIT archive rejects changed ${target}`, {
	timeout: 120_000
}, async () => {
	await assert.rejects(checkZeroPayloadWitEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${zeroPayloadWitEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
