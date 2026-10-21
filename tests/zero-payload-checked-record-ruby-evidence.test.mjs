/**
 * Test the retained hosted zero-payload Ruby archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkZeroPayloadRubyEvidence, zeroPayloadRubyEvidence
} from "./helpers/zero-payload-checked-record-ruby-evidence.mjs";

test("hosted zero-payload Ruby archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkZeroPayloadRubyEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1884);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/analyze/NativeExports.lean"
	, "hosted/artifact.zip.parts/0002.part"
]) test(`hosted zero-payload Ruby archive rejects changed ${target}`, {
	timeout: 120_000
}, async () => {
	await assert.rejects(checkZeroPayloadRubyEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${zeroPayloadRubyEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
