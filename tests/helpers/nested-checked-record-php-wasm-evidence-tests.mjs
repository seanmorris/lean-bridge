/**
 * Test the immutable four-cell nested checked-record PHP-Wasm evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordPhpWasmEvidence
	, nestedCheckedRecordPhpWasmEvidence
} from "./nested-checked-record-php-wasm-evidence.mjs";
import {
	nestedCheckedRecordPhpWasmProducer
	, nestedCheckedRecordPhpWasmVerifier
} from "./nested-checked-record-php-wasm-provenance.mjs";

test("nested checked-record PHP-Wasm evidence authenticates four package selections", async () => {
	const checked = await checkNestedCheckedRecordPhpWasmEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordPhpWasmProducer);
	assert.equal(checked.checkerCommit, nestedCheckedRecordPhpWasmVerifier);
	assert.deepEqual(checked.installedProfiles, ["php-wasm"]);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative");
	assert.equal(checked.files.length, 785);
	assert.equal(checked.selectedSources.length, 565);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.equal(item.counts.checks, full ? 3705 : 1060);
		assert.equal(item.counts.rejections, full ? 525 : 0);
		assert.equal(item.counts.hostRejections, full ? 16 : 6);
		assert.equal(item.counts.recoveries, full ? 256 : 0);
		assert.equal(item.counts.snapshots, full ? 1840 : 520);
		assert.equal(item.counts.snapshotControls, full ? 12 : 7);
		assert.equal(item.counts.rounds, 256);
		assert.equal(item.counts.word_bits, 32);
		assert.equal(item.counts.php, "8.4.1");
		assert.equal(item.executions, 12);
		assert.equal(item.dispatchObserved, false);
		assert.equal(item.records.length, item.route === "ordinary" ? 50 : 52);
		assert.equal(item.recordControls, item.records.length * 2);
		assert.equal(item.semanticControls, full ? 58 : 56);
		assert.equal(item.loadCeiling, 20);
		assert.deepEqual(item.packageFiles, { api: 17, component: 58, runtime: 22 });
	}
});

test("nested checked-record PHP-Wasm evidence rejects a changed record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNestedCheckedRecordPhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordPhpWasmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record PHP-Wasm evidence rejects a changed index", async () => {
	await assert.rejects(checkNestedCheckedRecordPhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordPhpWasmEvidence}/index.json`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record PHP-Wasm evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNestedCheckedRecordPhpWasmEvidence(readFile, {
		controls: "some"
	}));
});
