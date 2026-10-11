/**
 * Authenticate all four installed checked-record browser routes and their original producers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalJson, sha256 } from "../../src/capsule/node.mjs";
import { checkedRecordBrowserRoutes } from "./checked-record-browser-fixture.mjs";
import { checkCheckedRecordBrowserReport, checkedRecordBrowserRecords } from "./checked-record-browser-report.mjs";
import { checkedRecordBrowserNegativeControls } from "./checked-record-browser-controls.mjs";

const root = "docs/evidence/checked-record-browser-20261011";
const indexSha256 = "8a7284d2dbb30071f44a972c3c0726007ca59181864ed81ea2916938f1a5d518";
const archive = async read => {
	const bytes = await read("index.json"); assert.equal(sha256(bytes), indexSha256);
	const index = JSON.parse(bytes), files = new Map();
	assert.equal(bytes.toString(), canonicalJson(index));
	assert.equal(index.schemaVersion, 1); assert.equal(index.kind, "checked-record-browser-installed-v1");
	assert.deepEqual(index.runs.map(run => run.route), checkedRecordBrowserRoutes);
	assert.deepEqual(index.producerCommits, [...new Set(index.runs.map(run => run.producerCommit))]);
	assert.equal(index.files.length, 425);
	for(const file of index.files)
	{
		assert.ok(!file.path.startsWith("/") && !file.path.split("/").some(part => ["", ".", ".."].includes(part)));
		assert.ok(!files.has(file.path));
		const value = await read(file.path); assert.equal(value.length, file.bytes); assert.equal(sha256(value), file.sha256);
		files.set(file.path, value);
	}
	return { index, files };
};
const originals = (files, route) => {
	const prefix = `${route}/records/`;
	return new Map([...files].filter(([path]) => path.startsWith(prefix)).map(([path, bytes]) => [path.slice(prefix.length), bytes]));
};
const reader = files => async path => {
	assert.ok(files.has(path), "Missing original " + path); return files.get(path);
};

test("checked-record browser archive authenticates all four routes, original producers and installed lifecycles", async () => {
	const { index, files } = await archive(path => readFile(`${root}/${path}`));
	assert.equal(index.selectedSources.length, 38);
	for(const revision of index.producerCommits) for(const path of index.selectedSources)
	{
		const original = files.get(`sources/${revision}/${path}`);
		assert.deepEqual(original, execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 }));
		// Intervening CI repairs changed no selected compiler, fixture or acceptance source.
		assert.deepEqual(original, files.get(`sources/${index.producerCommits[0]}/${path}`));
	}
	let previousEnd = 0;
	for(const run of index.runs)
	{
		const start = JSON.parse(files.get(`${run.route}/start.json`)), end = JSON.parse(files.get(`${run.route}/end.json`));
		const tap = files.get(`${run.route}/run.tap`);
		assert.equal(start.route, run.route); assert.equal(start.revision, run.producerCommit);
		assert.equal(start.runnerSha256, sha256(files.get("runner.mjs")));
		assert.equal(end.tapSha256, sha256(tap)); assert.equal(run.tapSha256, end.tapSha256);
		assert.deepEqual([end.code, end.signal, end.diskStop], [0, null, false]);
		assert.ok(start.minimumMiB >= 2048 && end.minimumMiB >= 768);
		assert.ok(Date.parse(start.started) >= previousEnd && Date.parse(end.finished) >= Date.parse(start.started));
		previousEnd = Date.parse(end.finished);
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_TEST, "1");
		assert.equal(start.environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "chromium,firefox,webkit");
		assert.equal(start.environment.LEAN_BRIDGE_CHECKED_RECORD_BROWSER_NPM_ROUTES, run.route);
		assert.equal(start.command, "/usr/bin/taskset"); assert.deepEqual(start.args.slice(0, 2), ["-c", "3"]);
		assert.deepEqual(start.args.slice(3), ["--test", "--test-reporter=tap", "--test-concurrency=1", "tests/helpers/checked-record-browser-installed-tests.mjs"]);
		assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
		assert.match(tap.toString(), new RegExp(`ok 1 - installed npm checked records reproduce and relocate ${run.route}`, "u"));
		const records = originals(files, run.route);
		assert.deepEqual([...records.keys()].sort(), [...checkedRecordBrowserRecords].sort());
		assert.deepEqual(await checkCheckedRecordBrowserReport(reader(records), run), Object.fromEntries(Object.entries(run).filter(([key]) => !["tapSha256", "reportSha256"].includes(key))));
		assert.equal(run.reportSha256, sha256(records.get("report.json")));
	}
});

test("checked-record browser archive rejects missing and corrupted index and original bytes", async t => {
	const { files } = await archive(path => readFile(`${root}/${path}`));
	files.set("index.json", await readFile(`${root}/index.json`));
	for(const missing of files.keys())
	{
		await assert.rejects(archive(async path => { assert.notEqual(path, missing); return files.get(path); }));
		await assert.rejects(archive(async path => path === missing ? Buffer.concat([files.get(path), Buffer.from("changed")]) : files.get(path)));
	}
	t.diagnostic(`${2 * files.size} missing/corrupted index and original controls`);
});

test("checked-record browser originals reject missing records and coordinated compiler, caller and lifecycle substitutions", async t => {
	const { index, files } = await archive(path => readFile(`${root}/${path}`));
	for(const run of index.runs)
	{
		const controls = await checkedRecordBrowserNegativeControls(originals(files, run.route), run);
		assert.deepEqual(controls, { missing: 74, npm: 34, browser: 133 });
		t.diagnostic(`${run.route}: 74 missing records, 34 npm and 133 browser substitutions refused`);
	}
});
