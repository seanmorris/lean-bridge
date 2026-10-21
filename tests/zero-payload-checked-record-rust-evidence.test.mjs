/**
 * Test the retained hosted zero-payload Rust archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkZeroPayloadRustEvidence, zeroPayloadRustEvidence
} from "./helpers/zero-payload-checked-record-rust-evidence.mjs";

test("hosted zero-payload Rust archive authenticates every retained route", {
	timeout: 120_000
}, async () => {
	const result = await checkZeroPayloadRustEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 2006);
});

for(const target of [
	"ordinary-source/records/report.json"
	, "sources/producer/src/analyze/NativeExports.lean"
	, "hosted/artifact.zip.parts/0002.part"
]) test(`hosted zero-payload Rust archive rejects changed ${target}`, {
	timeout: 120_000
}, async () => {
	await assert.rejects(checkZeroPayloadRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${zeroPayloadRustEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
