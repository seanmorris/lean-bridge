/**
 * Test the hosted inherited checked-record browser evidence boundary. Before
 * all revisions and the index are pinned, every acceptance claim must refuse.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import {
	checkInheritedCheckedRecordBrowserEvidence
	, inheritedCheckedRecordBrowserEvidence
	, inheritedCheckedRecordBrowserEvidenceSha256
} from "./inherited-checked-record-browser-evidence.mjs";
import {
	inheritedCheckedRecordBrowserArchiver
	, inheritedCheckedRecordBrowserChecker
	, inheritedCheckedRecordBrowserConsumer
	, inheritedCheckedRecordBrowserNpmChecker
	, inheritedCheckedRecordBrowserPinnedRevisions
	, inheritedCheckedRecordBrowserProducer
} from "./inherited-checked-record-browser-provenance.mjs";

const revisions = [
	inheritedCheckedRecordBrowserProducer
	, inheritedCheckedRecordBrowserNpmChecker
	, inheritedCheckedRecordBrowserConsumer
	, inheritedCheckedRecordBrowserChecker
	, inheritedCheckedRecordBrowserArchiver
];
const pinned = revisions.every(revision => revision !== null)
	&& inheritedCheckedRecordBrowserEvidenceSha256 !== null;
const script = "scripts/archive-inherited-checked-record-browser-evidence.mjs";

test("inherited checked-record browser evidence fails closed until every pin exists", {
	skip: pinned && "Pinned hosted archive is authenticated below"
}, async () => {
	assert.throws(() => inheritedCheckedRecordBrowserPinnedRevisions()
		, /Pin the inherited checked-record browser/u);
	await assert.rejects(checkInheritedCheckedRecordBrowserEvidence()
		, /Pin the inherited checked-record browser/u);
	await assert.rejects(access(inheritedCheckedRecordBrowserEvidence)
		, { code: "ENOENT" });
	for(const args of [
		[], ["--root", "relative"], ["--root", "/absolute"]
		, ["--root", "/absolute", "--producer", "HEAD"
			, "--npm-checker", "a".repeat(40), "--consumer", "a".repeat(40)
			, "--checker", "a".repeat(40), "--run-id", "1"]
	]) {
		const run = spawnSync(process.execPath, [script, ...args], {
			encoding: "utf8", env: { PATH: process.env.PATH }
		});
		assert.notEqual(run.status, 0);
		assert.match(run.stderr, /Usage: archive-inherited-checked-record-browser-evidence/u);
	}
});

test("inherited checked-record browser evidence authenticates every hosted route", {
	skip: !pinned && "Runs once the hosted revisions and archive index are pinned"
	, timeout: 900_000
}, async () => {
	const checked = await checkInheritedCheckedRecordBrowserEvidence();
	assert.equal(checked.routes.length, 4);
	assert.equal(checked.hostedAcceptance, true);
	assert.equal(checked.supportPromoted, false);
	assert.deepEqual(Object.keys(checked.browserVersions).sort()
		, ["chromium", "firefox", "webkit"]);
	for(const route of checked.routes)
	{
		assert.equal(route.browserExecutions, 12);
		assert.equal(route.lifecycleObservations, 51);
		assert.equal(route.controls.record, 170);
		assert.equal(route.controls.browser, 165);
	}
	for(const target of [
		"index.json", "ordinary-full/records/browser.json"
		, "ordinary-result-only/npm.tap", "reviewed-full/records/controls.json"
		, "reviewed-result-only/verification.json"
		, "sources/consumer/tests/helpers/type-corpus-browser.mjs"
	]) await assert.rejects(checkInheritedCheckedRecordBrowserEvidence(
		async path => {
			const bytes = await readFile(path);
			return path === `${inheritedCheckedRecordBrowserEvidence}/${target}`
				? Buffer.concat([bytes, Buffer.from("changed")]) : bytes;
		}
	), undefined, target);
});
