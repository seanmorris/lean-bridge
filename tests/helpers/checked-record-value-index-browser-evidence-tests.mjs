/**
 * Require complete immutable hosted value-index npm/browser evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkCheckedRecordValueIndexBrowserEvidence
	, checkedRecordValueIndexBrowserEvidence
} from "./checked-record-value-index-browser-evidence.mjs";

test("value-index browser evidence authenticates and replays every hosted route", {
	timeout: 900_000
}, async () => {
	const checked = await checkCheckedRecordValueIndexBrowserEvidence();
	assert.equal(checked.routes.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedRun.runId, 39201330491);
	assert.equal(checked.hostedRun.artifact.id, 12164886878);
	assert.equal(checked.files.length, 2227);
	for(const route of checked.routes)
	{
		assert.equal(route.browserExecutions, 12);
		assert.equal(route.lifecycleObservations, 51);
		assert.equal(route.controls.fastPasses, 11);
		assert.equal(route.controls.skippedInstalledRoutes, 4);
	}
});

test("value-index browser evidence rejects altered hosted and replay bytes", {
	timeout: 900_000
}, async () => {
	for(const target of [
		"index.json", "hosted/api/run.json"
		, "hosted/artifact.zip.parts/0000.part"
		, "ordinary-source/records/report.json"
		, "sources/checker/.github/workflows/checked-record-value-index-browser.yml"
	]) await assert.rejects(checkCheckedRecordValueIndexBrowserEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${checkedRecordValueIndexBrowserEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}
	), undefined, target);
});
