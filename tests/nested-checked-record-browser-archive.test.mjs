/**
 * Immutable nested checked-record browser archive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkNestedCheckedRecordBrowserArchive,
	nestedCheckedRecordBrowserArchive,
	nestedCheckedRecordBrowserArchiveSha256
} from "./helpers/nested-checked-record-browser-archive.mjs";

test("the nested checked-record browser archive authenticates every route", async () => {
	const checked = await checkNestedCheckedRecordBrowserArchive();
	assert.equal(checked.routes.length, 4);
	assert.equal(checked.files.length, 410);
	assert.equal(checked.sourceSnapshots.length, 4);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	for(const route of checked.routes)
	{
		assert.equal(route.browserExecutions, 12);
		assert.equal(route.lifecycleObservations, 51);
		assert.equal(route.controls.record, 170);
		assert.equal(route.controls.browser, 162);
	}
});

test("the nested checked-record browser archive rejects changed originals", async () => {
	const indexPath = `${nestedCheckedRecordBrowserArchive}/index.json`;
	assert.match(nestedCheckedRecordBrowserArchiveSha256, /^[a-f0-9]{64}$/u);
	const resultOnly = `${nestedCheckedRecordBrowserArchive}/ordinary-result-only/records`;
	const receipt = JSON.parse(await readFile(`${resultOnly}/report.json`)).receipt;
	const paths = [
		indexPath
		, `${nestedCheckedRecordBrowserArchive}/ordinary-full/records/browser.json`
		, `${resultOnly}/handoff/${receipt.package.archive}`
		, `${nestedCheckedRecordBrowserArchive}/sources/consumer/tests/helpers/type-corpus-browser.mjs`
	];
	for(const path of paths)
	{
		const changed = Buffer.concat([await readFile(path), Buffer.from("changed")]);
		await assert.rejects(checkNestedCheckedRecordBrowserArchive(
			candidate => candidate === path ? changed : readFile(candidate)
		), undefined, path);
	}
});
