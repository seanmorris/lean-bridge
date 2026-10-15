/**
 * Test the immutable four-selection primitive-base nominal PHP-Wasm archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNominalPrimitiveSubtypePhpWasmEvidence
	, nominalPrimitiveSubtypePhpWasmEvidence
} from "./nominal-primitive-subtype-php-wasm-evidence.mjs";
import { nominalPrimitiveSubtypePhpWasmProducer } from "./nominal-primitive-subtype-php-wasm-provenance.mjs";

test("primitive-base nominal PHP-Wasm evidence authenticates four installed package selections", async () => {
	const checked = await checkNominalPrimitiveSubtypePhpWasmEvidence();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypePhpWasmProducer);
	assert.deepEqual(checked.installedProfiles, ["php-wasm"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative"); assert.equal(checked.files.length, 779);
	assert.equal(checked.selectedSources.length, 538);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.equal(item.counts.checks, full ? 1821 : 612);
		assert.equal(item.counts.rejections, full ? 283 : 0);
		assert.equal(item.counts.hostRejections, 8); assert.equal(item.counts.snapshotControls, 12);
		assert.equal(item.counts.rounds, 256); assert.equal(item.counts.wordBits, 32);
		assert.equal(item.counts.word_bits, 32); assert.equal(item.counts.php, "8.4.1");
		assert.equal(item.executions, 12); assert.equal(item.dispatchObserved, false);
		assert.equal(item.recordControls, item.records.length * 2);
		assert.equal(item.semanticControls, full ? 55 : 53); assert.equal(item.loadCeiling, 8);
	}
	assert.equal(checked.rejected.producerCommit, "d1974b22c9ea4bb19da90817d9a08d6a6d880a28");
	assert.equal(checked.rejected.records, 25);
});

test("primitive-base nominal PHP-Wasm evidence rejects a changed retained report", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNominalPrimitiveSubtypePhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypePhpWasmEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base nominal PHP-Wasm evidence rejects a changed archive index", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypePhpWasmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypePhpWasmEvidence}/index.json`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base nominal PHP-Wasm evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypePhpWasmEvidence(readFile, { controls: "some" }));
});
