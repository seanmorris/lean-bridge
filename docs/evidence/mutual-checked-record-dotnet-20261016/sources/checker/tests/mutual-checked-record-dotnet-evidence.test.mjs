/**
 * Immutable recursive checked-record .NET archive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkMutualCheckedRecordDotnetEvidence, mutualCheckedRecordDotnetEvidence
} from "./helpers/mutual-checked-record-dotnet-evidence.mjs";
import {
	mutualCheckedRecordDotnetProducer
} from "./helpers/mutual-checked-record-dotnet-provenance.mjs";

test("recursive checked-record .NET evidence authenticates both installed routes", async () => {
	const checked = await checkMutualCheckedRecordDotnetEvidence();
	assert.equal(checked.producerCommit, mutualCheckedRecordDotnetProducer);
	assert.equal(checked.runs.length, 2);
	assert.equal(checked.sourceSnapshots.length, 2);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	assert.deepEqual(checked.runs.map(run => [run.route, run.recordPaths.length])
		, [["ordinary", 28], ["reviewed", 30]]);
	for(const run of checked.runs)
	{
		assert.equal(run.result.checks, 1359);
		assert.equal(run.result.rejections, 136);
		assert.equal(run.result.hostRejections, 134);
		assert.equal(run.result.calls, 676);
		assert.equal(run.result.snapshots, 676);
		assert.equal(run.result.recoveries, 142);
		assert.equal(run.result.rounds, 128);
		assert.equal(run.executions, 3);
		assert.equal(run.independentBuilds, 2);
	}
});

test("recursive checked-record .NET evidence rejects changed originals", async () => {
	const targets = [
		`${mutualCheckedRecordDotnetEvidence}/index.json`
		, `${mutualCheckedRecordDotnetEvidence}/ordinary/records/report.json`
		, `${mutualCheckedRecordDotnetEvidence}/reviewed/records/handoff/archives/Mutualcheckedrecords.Api.1.0.0.nupkg`
		, `${mutualCheckedRecordDotnetEvidence}/sources/producer/tests/fixtures/mutual-checked-record-consumers/dotnet.cs`
	];
	for(const target of targets)
	{
		await assert.rejects(checkMutualCheckedRecordDotnetEvidence(async path => {
			const bytes = await readFile(path);
			return path === target
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}), undefined, target);
	}
});
