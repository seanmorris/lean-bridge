/**
 * Immutable recursive checked-record JVM archive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkMutualCheckedRecordJvmEvidence, mutualCheckedRecordJvmEvidence
} from "./helpers/mutual-checked-record-jvm-evidence.mjs";
import {
	mutualCheckedRecordJvmProducer
} from "./helpers/mutual-checked-record-jvm-provenance.mjs";

test("recursive checked-record JVM evidence authenticates both installed routes", async () => {
	const checked = await checkMutualCheckedRecordJvmEvidence();
	assert.equal(checked.producerCommit, mutualCheckedRecordJvmProducer);
	assert.equal(checked.runs.length, 2);
	assert.equal(checked.sourceSnapshots.length, 2);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.runs.map(run => [run.route, run.recordPaths.length])
		, [["ordinary", 36], ["reviewed", 38]]);
	for(const run of checked.runs)
	{
		assert.equal(run.results.java.checks, 590);
		assert.equal(run.results.java.rejections, 72);
		assert.equal(run.results.java.hostRejections, 5);
		assert.equal(run.results.java.calls, 290);
		assert.equal(run.results.java.snapshots, 290);
		assert.equal(run.results.java.recoveries, 77);
		assert.equal(run.results.java.rounds, 64);
		assert.equal(run.results.kotlin.checks, 593);
		assert.equal(run.results.kotlin.rejections, 72);
		assert.equal(run.results.kotlin.hostRejections, 6);
		assert.equal(run.results.kotlin.calls, 292);
		assert.equal(run.results.kotlin.snapshots, 292);
		assert.equal(run.results.kotlin.recoveries, 78);
		assert.equal(run.results.kotlin.rounds, 64);
		assert.equal(run.executions, 6);
		assert.equal(run.independentBuilds, 2);
	}
});

test("recursive checked-record JVM evidence rejects changed originals", async () => {
	const targets = [
		`${mutualCheckedRecordJvmEvidence}/index.json`
		, `${mutualCheckedRecordJvmEvidence}/ordinary/records/report.json`
		, `${mutualCheckedRecordJvmEvidence}/reviewed/records/handoff/archives/mutualcheckedrecords-1.0.0.jar`
		, `${mutualCheckedRecordJvmEvidence}/sources/producer/tests/fixtures/mutual-checked-record-consumers/kotlin.kt`
	];
	for(const target of targets)
	{
		await assert.rejects(checkMutualCheckedRecordJvmEvidence(async path => {
			const bytes = await readFile(path);
			return path === target
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}), undefined, target);
	}
});
