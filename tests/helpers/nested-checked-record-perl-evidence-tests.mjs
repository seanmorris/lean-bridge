/**
 * Test the immutable four-selection nested checked-record Perl archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordPerlEvidence
	, nestedCheckedRecordPerlEvidence
	, nestedCheckedRecordPerlEvidenceSha256
} from "./nested-checked-record-perl-evidence.mjs";
import {
	nestedCheckedRecordPerlEvidenceCases
	, nestedCheckedRecordPerlProducer
} from "./nested-checked-record-perl-provenance.mjs";

test("nested checked-record Perl evidence authenticates four installed CPAN selections", async () => {
	assert.match(nestedCheckedRecordPerlEvidenceSha256, /^[a-f0-9]{64}$/u);
	assert.notEqual(nestedCheckedRecordPerlEvidenceSha256, "0".repeat(64));
	const checked = await checkNestedCheckedRecordPerlEvidence();
	assert.equal(checked.producerCommit, nestedCheckedRecordPerlProducer);
	assert.deepEqual(checked.installedProfiles, ["perl"]);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => item.name)
		, nestedCheckedRecordPerlEvidenceCases);
	assert.deepEqual(checked.selections.map(item => [item.authorRoute, item.apiMode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	for(const item of checked.selections)
	{
		assert.deepEqual(item.configurations, [
			"5.36.3-threaded", "5.36.3-unthreaded"
			, "5.38.2-threaded", "5.38.2-unthreaded"
		]);
		assert.deepEqual(item.installModes, ["prebuilt-only", "build-xs"]);
		assert.equal(item.builds, 2);
		assert.equal(item.executions, 16);
		assert.equal(item.records.length, item.authorRoute === "ordinary" ? 108 : 110);
	}
	assert.ok(checked.files.length > 400);
});

test("nested checked-record Perl evidence rejects a changed retained record", async () => {
	const target = "ordinary-full/producer/run.tap";
	await assert.rejects(checkNestedCheckedRecordPerlEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${nestedCheckedRecordPerlEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
