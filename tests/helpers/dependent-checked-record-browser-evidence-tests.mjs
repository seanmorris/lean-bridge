/**
 * Test the retained hosted npm/browser dependent checked-record archive.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkDependentCheckedRecordBrowserEvidence
	, dependentCheckedRecordBrowserEvidence
} from "./dependent-checked-record-browser-evidence.mjs";

test("hosted dependent browser archive authenticates every retained route", {
	timeout: 900_000
}, async () => {
	const result = await checkDependentCheckedRecordBrowserEvidence();
	assert.equal(result.hostedAcceptance, true);
	assert.equal(result.supportPromoted, false);
	assert.equal(result.routes.length, 4);
	assert.equal(result.hostedRun.runId, 39919381925);
	assert.equal(result.hostedRun.job.id, 120300651663);
	assert.equal(result.hostedRun.artifact.id, 12491719653);
	assert.equal(result.files.length, 1211);
	for(const route of result.routes)
	{
		assert.equal(route.browserExecutions, 12);
		assert.equal(route.lifecycleObservations, 51);
	}
});

for(const target of [
	"index.json", "hosted/api/run.json"
	, "hosted/artifact.zip.parts/0000.part"
	, "ordinary-source/records/report.json"
	, "sources/checker/.github/workflows/dependent-checked-record-browser.yml"
]) test(`hosted dependent browser archive rejects changed ${target}`, {
	timeout: 900_000
}, async () => {
	await assert.rejects(checkDependentCheckedRecordBrowserEvidence(async path => {
		const bytes = await readFile(path);
		return path === `${dependentCheckedRecordBrowserEvidence}/${target}`
			? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
	}));
});
