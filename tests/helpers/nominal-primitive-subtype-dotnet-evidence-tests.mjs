/**
 * Test the immutable four-selection primitive-base nominal .NET archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNominalPrimitiveSubtypeDotnetEvidence
	, nominalPrimitiveSubtypeDotnetEvidence
} from "./nominal-primitive-subtype-dotnet-evidence.mjs";
import { nominalPrimitiveSubtypeDotnetProducer } from "./nominal-primitive-subtype-dotnet-provenance.mjs";

test("primitive-base .NET evidence authenticates four installed NuGet selections", async () => {
	const checked = await checkNominalPrimitiveSubtypeDotnetEvidence();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeDotnetProducer);
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
		assert.equal(item.counts.checks, full ? 1346 : 603);
		assert.equal(item.counts.rejections, full ? 306 : 0);
		assert.equal(item.counts.hostRejections, full ? 7 : 1);
		assert.equal(item.counts.snapshotControls, 30); assert.equal(item.counts.rounds, 256);
		assert.equal(item.counts.wordBits, 64); assert.equal(item.executions, 3);
		assert.equal(item.generatorModules, 18); assert.equal(item.dispatchObserved, false);
		assert.equal(item.recordControls, item.records * 2);
		assert.equal(item.environmentControls, 28); assert.equal(item.packageControls, 5);
		assert.equal(item.modelControls, full ? 5 : 4); assert.equal(item.executionControls, 30);
		assert.equal(item.loadCeiling, 8);
	}
});

test("primitive-base .NET evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNominalPrimitiveSubtypeDotnetEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypeDotnetEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base .NET evidence rejects a changed archive index", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypeDotnetEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypeDotnetEvidence}/index.json`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}, { controls: "none" }));
});

test("primitive-base .NET evidence admits only frozen control scopes", async () => {
	await assert.rejects(checkNominalPrimitiveSubtypeDotnetEvidence(readFile, { controls: "some" }));
});
