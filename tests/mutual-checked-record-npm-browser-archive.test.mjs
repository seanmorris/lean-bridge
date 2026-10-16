/**
 * Immutable recursive checked-record Node/browser archive acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkMutualCheckedRecordNpmBrowserArchive
	, mutualCheckedRecordNpmBrowserArchive
	, mutualCheckedRecordNpmBrowserArchiveSha256
} from "./helpers/mutual-checked-record-npm-browser-archive.mjs";

test("the recursive checked-record npm/browser archive authenticates both routes", async () => {
	const checked = await checkMutualCheckedRecordNpmBrowserArchive();
	assert.equal(checked.routes.length, 2);
	assert.equal(checked.files.length, 238);
	assert.equal(checked.sourceSnapshots.length, 3);
	assert.equal(checked.supportPromoted, false);
	assert.equal(checked.hostedAcceptance, false);
	for(const route of checked.routes)
	{
		assert.equal(route.recordCount, 80);
		assert.equal(route.nodeObservations, 2);
		assert.equal(route.browserExecutions, 12);
		assert.equal(route.lifecycleObservations, 51);
		assert.equal(route.expected.checks, 1358);
		assert.equal(route.expected.rejections, 271);
		assert.equal(route.expected.recoveries, 143);
	}
});

test("the recursive checked-record npm/browser archive rejects changed originals", async () => {
	const indexPath = `${mutualCheckedRecordNpmBrowserArchive}/index.json`;
	assert.match(mutualCheckedRecordNpmBrowserArchiveSha256, /^[a-f0-9]{64}$/u);
	const ordinary = `${mutualCheckedRecordNpmBrowserArchive}/ordinary/records`;
	const report = JSON.parse(await readFile(`${ordinary}/report.json`));
	const paths = [
		indexPath
		, `${ordinary}/report.json`
		, `${ordinary}/browser/browser-react/observations.json`
		, `${ordinary}/handoff/${report.receipt.package.archive}`
		, `${mutualCheckedRecordNpmBrowserArchive}/sources/producer/src/build/component-recursive-diagnostics.mjs`
	];
	for(const path of paths)
	{
		const changed = Buffer.concat([await readFile(path), Buffer.from("changed")]);
		await assert.rejects(checkMutualCheckedRecordNpmBrowserArchive(
			candidate => candidate === path ? changed : readFile(candidate)
		), undefined, path);
	}
});
