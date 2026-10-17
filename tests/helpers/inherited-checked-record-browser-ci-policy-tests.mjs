/**
 * Source-only controls for inherited checked-record browser CI admission.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertInheritedCheckedRecordBrowserTap
	, checkInheritedCheckedRecordBrowserCiRecords
	, parseInheritedCheckedRecordBrowserCiArgs
} from "./inherited-checked-record-browser-ci-report.mjs";

const tap = tests => `TAP version 13\n${Array.from({ length: tests }
	, (_, index) => `# Subtest: accepted ${index}\nok ${index + 1} - accepted ${index}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n`).join("")}1..${tests}\n# tests ${tests}\n# suites 0\n# pass ${tests}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
const args = options => Object.entries(options)
	.flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary-full", producer: "a".repeat(40)
	, "npm-checker": "b".repeat(40), consumer: "c".repeat(40)
	, checker: "d".repeat(40), directory: "records", "npm-tap": "npm.tap"
	, "browser-tap": "browser.tap", "controls-tap": "controls.tap"
	, runtime: "runtime.json"
};

test("inherited browser CI arguments are closed and unambiguous", () => {
	assert.deepEqual(parseInheritedCheckedRecordBrowserCiArgs(args(options)), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseInheritedCheckedRecordBrowserCiArgs(args(
			Object.fromEntries(Object.entries(options).filter(([name]) => name !== key))
		)));
		assert.throws(() => parseInheritedCheckedRecordBrowserCiArgs([
			...args(options), "--" + key, options[key]
		]));
	}
	for(const changed of [
		{ route: "unknown" }, { producer: "HEAD" }, { "npm-checker": "a".repeat(39) }
		, { consumer: "a".repeat(41) }, { checker: "A".repeat(40) }
		, { unknown: "value" }
	]) assert.throws(() => parseInheritedCheckedRecordBrowserCiArgs(
		args({ ...options, ...changed })
	));
});

test("inherited browser CI TAP refuses failures, skips and incomplete runs", () => {
	for(const count of [1, 2])
	{
		const source = tap(count);
		assertInheritedCheckedRecordBrowserTap(source, count);
		for(const changed of [
			source.replace("ok 1 -", "not ok 1 -")
			, source.replace(`# pass ${count}`, `# pass ${count - 1}`)
			, source.replace("# skipped 0", "# skipped 1")
			, source.replace(`1..${count}\n`, "")
			, source + "Bail out! late\n"
		]) assert.throws(() => assertInheritedCheckedRecordBrowserTap(
			changed, count
		));
	}
});

test("inherited browser CI refuses bad scope before reading records", async () => {
	let reads = 0;
	const original = {
		npmTap: tap(1), browserTap: tap(2), controlsTap: tap(1)
		, runtime: { node: process.version, platform: "linux", arch: "x64" }
		, paths: []
		, read: async () => {
			reads++;
			throw new Error("records required");
		}
	};
	await assert.rejects(checkInheritedCheckedRecordBrowserCiRecords(
		{ ...options, route: "unknown" }, original), assert.AssertionError);
	assert.equal(reads, 0);
	await assert.rejects(checkInheritedCheckedRecordBrowserCiRecords(
		options, { ...original, browserTap: tap(1) }), assert.AssertionError);
	assert.equal(reads, 0);
	await assert.rejects(checkInheritedCheckedRecordBrowserCiRecords(
		options, original), /records required/u);
	assert.equal(reads, 1);
});
