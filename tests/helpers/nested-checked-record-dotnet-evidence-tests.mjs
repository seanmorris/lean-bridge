/**
 * Test the immutable four-selection nested checked-record .NET archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordDotnetEvidence
	, nestedCheckedRecordDotnetEvidence
} from "./nested-checked-record-dotnet-evidence.mjs";
import { nestedCheckedRecordDotnetProducer } from "./nested-checked-record-dotnet-provenance.mjs";

test("nested checked-record .NET evidence authenticates four installed NuGet selections", async () => {
	const checked = await checkNestedCheckedRecordDotnetEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordDotnetProducer);
	assert.deepEqual(checked.installedProfiles, ["dotnet"]);
	assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.equal(checked.controls, "representative"); assert.equal(checked.files.length, 876);
	assert.equal(checked.selectedSources.length, 550);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode, item.attempt]), [
		["ordinary", "full", "r1"], ["ordinary", "result-only", "r1"]
		, ["reviewed", "full", "r1"], ["reviewed", "result-only", "r1"]
	]);
	for(const item of checked.selections)
	{
		const full = item.mode === "full";
		assert.equal(item.counts.checks, full ? 3924 : 1290);
		assert.equal(item.counts.rejections, full ? 524 : 0);
		assert.equal(item.counts.hostRejections, full ? 7 : 4);
		assert.equal(item.counts.recoveries, full ? 528 : 1);
		assert.equal(item.counts.snapshots, full ? 1054 : 1);
		assert.equal(item.counts.rounds, 256);
		assert.equal(item.counts.wordBits, 64); assert.equal(item.executions, 3);
		assert.equal(item.generatorModules, 18); assert.equal(item.dispatchObserved, false);
		assert.equal(item.recordControls, item.records * 2);
		assert.equal(item.environmentControls, 28); assert.equal(item.packageControls, 5);
		assert.equal(item.modelControls, full ? 5 : 4); assert.equal(item.executionControls, 30);
		assert.equal(item.loadCeiling, 10);
	}
});

test("nested checked-record .NET evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNestedCheckedRecordDotnetEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordDotnetEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record .NET evidence rejects a changed archive index", async () => {
	await assert.rejects(checkNestedCheckedRecordDotnetEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordDotnetEvidence}/index.json`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("nested checked-record .NET evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNestedCheckedRecordDotnetEvidence(readFile, { controls: "some" }));
});
