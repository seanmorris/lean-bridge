/**
 * Test the retained hosted Rust value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexRustEvidence
	, checkedRecordValueIndexRustEvidence
} from "./checked-record-value-index-rust-evidence.mjs";

test("hosted value-index Rust archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkCheckedRecordValueIndexRustEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1936);
	assert.equal(result.hostedRun.artifact.id, 12245482092);
});

test("hosted value-index Rust archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexRustEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});

test("hosted value-index Rust archive rejects a changed original ZIP part", async () => {
	const target = "hosted/artifact.zip.parts/0000.part";
	await assert.rejects(checkCheckedRecordValueIndexRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexRustEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	}));
});
