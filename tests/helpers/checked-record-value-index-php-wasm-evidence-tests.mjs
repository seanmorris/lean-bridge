/**
 * Test the retained hosted PHP-Wasm value-index archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexPhpWasmEvidence
	, checkedRecordValueIndexPhpWasmEvidence
} from "./checked-record-value-index-php-wasm-evidence.mjs";
import "./checked-record-value-index-php-wasm-archive-source-history-tests.mjs";
import "./checked-record-value-index-php-wasm-promotion-tests.mjs";
import "./checked-record-value-index-php-wasm-promotion-source-history-tests.mjs";

test("hosted value-index PHP-Wasm archive authenticates every retained route", {
	timeout: 900_000
}, async () => {
	const result = await checkCheckedRecordValueIndexPhpWasmEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.accepted.length, 4);
	assert.equal(result.files.length, 2836);
	assert.equal(result.hostedRun.artifact.id, 12241424497);
});

test("hosted value-index PHP-Wasm archive rejects a changed retained byte", async () => {
	const target = "ordinary-source/records/report.json";
	await assert.rejects(checkCheckedRecordValueIndexPhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexPhpWasmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});

test("hosted value-index PHP-Wasm archive rejects a changed original ZIP part", async () => {
	const target = "hosted/artifact.zip.parts/0000.part";
	await assert.rejects(checkCheckedRecordValueIndexPhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${checkedRecordValueIndexPhpWasmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from([0])]) : bytes;
	}));
});
