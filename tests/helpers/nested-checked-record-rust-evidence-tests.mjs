/**
 * Test the immutable four-cell nested checked-record Rust evidence archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordRustEvidence
	, nestedCheckedRecordRustEvidence
} from "./nested-checked-record-rust-evidence.mjs";
import { nestedCheckedRecordRustProducer } from "./nested-checked-record-rust-provenance.mjs";

test("nested checked-record Rust evidence authenticates four installed crate selections", {
	timeout: 900_000
}, async () => {
	const checked = await checkNestedCheckedRecordRustEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordRustProducer);
	assert.equal(checked.checkerCommit, nestedCheckedRecordRustProducer);
	assert.deepEqual(checked.installedProfiles, ["rust"]);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative");
	assert.equal(checked.files.length, 868);
	assert.equal(checked.selectedSources.length, 556);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		const reviewed = item.route === "reviewed";
		assert.deepEqual(item.counts, {
			checks: full ? 3914 : 1291
			, rejections: full ? 525 : 0
			, recoveries: full ? 256 : 0
			, snapshots: full ? 1824 : 514
			, snapshotControls: full ? 9 : 7, rounds: 256
		});
		assert.equal(item.executions, 3);
		assert.equal(item.records, reviewed ? 76 : 74);
		assert.equal(item.generatorModules, 21);
		assert.equal(item.dispatchObserved, false);
		assert.equal(item.loadCeiling, 20);
		assert.equal(item.recordControls, item.records * 2);
		assert.equal(item.resourceControls, 8);
		assert.equal(item.environmentControls, full ? 60 : 61);
		assert.equal(item.packageControls, 6);
		assert.equal(item.modelControls, full ? 6 : 5);
		assert.equal(item.executionControls, 30);
		assert.equal(item.artifacts.length, 1);
		assert.ok(item.artifacts[0].path.endsWith(".crate"));
		assert.match(item.dependencyArchiveSha256, /^[a-f0-9]{64}$/u);
	}
});

test("nested checked-record Rust evidence rejects a changed index", async () => {
	const target = nestedCheckedRecordRustEvidence + "/index.json";
	await assert.rejects(checkNestedCheckedRecordRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === target
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record Rust evidence rejects a changed retained control", async () => {
	const target = nestedCheckedRecordRustEvidence
		+ "/ordinary-full/controls.json";
	await assert.rejects(checkNestedCheckedRecordRustEvidence(async path => {
		const bytes = await readFile(path);
		return path === target
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});
