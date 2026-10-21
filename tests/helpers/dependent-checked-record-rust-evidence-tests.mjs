/**
 * Test the retained hosted Rust dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordRustEvidence
	, dependentCheckedRecordRustEvidence
} from "./dependent-checked-record-rust-evidence.mjs";

test("hosted dependent Rust archive authenticates every retained route", {
	timeout: 180_000
}, async () => {
	const result = await checkDependentCheckedRecordRustEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 1549);
	assert.equal(result.hostedRun.artifact.id, 12378146701);
});

test("hosted dependent Rust archive rejects a changed retained record"
	, async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkDependentCheckedRecordRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordRustEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	})
	);
	}
);

test("hosted dependent Rust archive rejects a changed original ZIP part"
	, async () => {
	const target = "hosted/artifact.zip.parts/0000.part";
	await assert.rejects(checkDependentCheckedRecordRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordRustEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	})
	);
	}
);
