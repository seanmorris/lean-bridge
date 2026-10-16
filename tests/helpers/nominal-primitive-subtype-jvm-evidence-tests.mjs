/**
 * Test the immutable four-selection nineteen-base nominal JVM archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkNominalPrimitiveSubtypeJvmEvidence, nominalPrimitiveSubtypeJvmEvidence } from "./nominal-primitive-subtype-jvm-evidence.mjs";
import { nominalPrimitiveSubtypeJvmCounts } from "./nominal-primitive-subtype-jvm-fixture.mjs";
import { nominalPrimitiveSubtypeJvmProducer } from "./nominal-primitive-subtype-jvm-provenance.mjs";

test("primitive-base JVM evidence authenticates four serial installed selections and both preserved launches", async () => {
	const checked = await checkNominalPrimitiveSubtypeJvmEvidence();
	assert.equal(checked.producerCommit, nominalPrimitiveSubtypeJvmProducer);
	assert.deepEqual(checked.installedProfiles, ["java", "kotlin"]); assert.equal(checked.supportPromoted, false); assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => [item.route, item.mode, item.attempt]), [
		["ordinary", "full", "r2"], ["ordinary", "result-only", "r1"]
		, ["reviewed", "full", "r1"], ["reviewed", "result-only", "r1"]
	]);
	for(const item of checked.selections)
	{
		assert.match(item.javaVersion, /^(?:openjdk|java) 22\.0\.2[ +]/u);
		// Java and Kotlin each run installed, after relocation and from a source-free deployment.
		const counts = ["java", "kotlin"].map(profile => nominalPrimitiveSubtypeJvmCounts[profile][item.mode]);
		assert.equal(item.executions, 6);
		for(const key of ["checks", "rejections", "hostRejections"])
			assert.equal(item[key], 3 * (counts[0][key] + counts[1][key]), key);
		assert.equal(item.controls.recordControls, item.records.length * 2);
		for(const [key, value] of Object.entries(item.controls)) assert.ok(Number.isInteger(value) && value > 0, key);
	}
	assert.deepEqual(checked.preserved.map(item => [item.runnerRevision, item.producerCode, item.controlsCode, item.counted]), [
		["88cf601", 1, null, false], ["e0fed7f-v1", 0, 1, false]
	]);
});

test("primitive-base JVM evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/records/report.json";
	await assert.rejects(checkNominalPrimitiveSubtypeJvmEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nominalPrimitiveSubtypeJvmEvidence}/${target}` ? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
