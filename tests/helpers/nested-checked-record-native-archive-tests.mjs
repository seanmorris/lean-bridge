/**
 * Tests for the immutable nested checked-record C/C++ acceptance archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordNativeArchive
	, nestedCheckedRecordNativeArchiver
} from "./nested-checked-record-native-archive.mjs";
import {
	nestedCheckedRecordNativeProducer
} from "./nested-checked-record-native-evidence.mjs";

test("the nested checked-record native archive retains four exact installed selections"
	, { timeout: 300_000 }, async () => {
	const checked = await checkNestedCheckedRecordNativeArchive();
	assert.equal(checked.producerCommit, nestedCheckedRecordNativeProducer);
	assert.equal(checked.archiveCommit, nestedCheckedRecordNativeArchiver);
	assert.deepEqual(checked.installedProfiles, ["c", "cpp"]);
	assert.deepEqual(checked.runs.map(run => [run.route, run.mode]), [
		["ordinary", "full"], ["ordinary", "result-only"]
		, ["reviewed", "full"], ["reviewed", "result-only"]
	]);
	assert.deepEqual(checked.runs.map(run => run.recordControls), [31, 31, 33, 33]);
	assert.ok(checked.runs.every(run => run.reportControls === 34
		&& run.resourceControls === 5 && run.modelControls === 4
		&& run.packageControls === 2 && run.executions === 4
		&& run.initialExecutions === 2));
	assert.equal(checked.supportPromoted, false);
		assert.equal(checked.hostedAcceptance, false);}
);

test("the native archive rejects changed index bytes before accepting evidence", async () => {
	await assert.rejects(checkNestedCheckedRecordNativeArchive(async path => {
		const bytes = await readFile(path);
		return path.endsWith("/index.json")
			? Buffer.concat([bytes, Buffer.from("\n")]) : bytes;
	}));
});
