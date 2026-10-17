/**
 * Test the immutable four-cell recursive checked-record Perl archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkRecursiveCheckedRecordPerlEvidence
	, recursiveCheckedRecordPerlEvidence
	, recursiveCheckedRecordPerlEvidenceSha256
} from "./recursive-checked-record-perl-evidence.mjs";
import { recursiveCheckedRecordPerlExpected } from "./recursive-checked-record-perl-fixture.mjs";
import {
	recursiveCheckedRecordPerlEvidenceCases
	, recursiveCheckedRecordPerlProducer
} from "./recursive-checked-record-perl-provenance.mjs";

test("recursive checked-record Perl evidence authenticates four installed CPAN cells", async () => {
	assert.match(recursiveCheckedRecordPerlEvidenceSha256, /^[a-f0-9]{64}$/u);
	assert.notEqual(recursiveCheckedRecordPerlEvidenceSha256, "0".repeat(64));
	const checked = await checkRecursiveCheckedRecordPerlEvidence();
	assert.equal(checked.producerCommit, recursiveCheckedRecordPerlProducer);
	assert.deepEqual(checked.installedProfiles, ["perl"]);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.selections.map(item => item.name)
		, recursiveCheckedRecordPerlEvidenceCases);
	assert.deepEqual(checked.selections.map(item => [item.route, item.fixture]), [
		["ordinary", "recursive"], ["ordinary", "mutual"]
		, ["reviewed", "recursive"], ["reviewed", "mutual"]
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
		assert.equal(item.records.length, item.route === "ordinary" ? 128 : 130);
		assert.equal(item.handoff.length, 4);
		assert.deepEqual(item.report.reports.map(report => report.counts)
			, Array(8).fill(recursiveCheckedRecordPerlExpected[item.fixture]));
	}
	assert.ok(checked.files.length > 650);
	assert.ok(checked.files.every(item => !item.path.includes("/handoff/archives/")));
});

test("recursive checked-record Perl evidence rejects a changed retained record", async () => {
	const target = "ordinary-recursive/producer/run.tap";
	await assert.rejects(checkRecursiveCheckedRecordPerlEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${recursiveCheckedRecordPerlEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});

test("recursive checked-record Perl evidence rejects a changed handoff receipt", async () => {
	const target = "ordinary-mutual/records/handoff/package-set-receipt.json";
	await assert.rejects(checkRecursiveCheckedRecordPerlEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${recursiveCheckedRecordPerlEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from(" ")]) : bytes;
	}));
});
