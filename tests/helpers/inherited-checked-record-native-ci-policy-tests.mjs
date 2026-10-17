/**
 * Source-only controls for inherited checked-record native CI records and TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertInheritedCheckedRecordNativeCiTap
	, checkInheritedCheckedRecordNativeCiRecords
	, inheritedCheckedRecordNativeCiTestName
	, parseInheritedCheckedRecordNativeCiArgs
} from "./inherited-checked-record-native-ci-report.mjs";

const argsOf = options => Object.entries(options)
	.flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary", mode: "full", producer: "a".repeat(40)
	, directory: "synthetic-records", tap: "synthetic.tap", glibc: "2.38"
	, "max-load": "12"
};
const syntheticTap = (route, mode) => {
	const name = inheritedCheckedRecordNativeCiTestName(route, mode);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
};

test("inherited native CI refuses unknown, duplicate and incomplete selections", () => {
	const args = argsOf(options);
	assert.deepEqual(parseInheritedCheckedRecordNativeCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseInheritedCheckedRecordNativeCiArgs(argsOf(
			Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseInheritedCheckedRecordNativeCiArgs(
			[...args, "--" + key, options[key]]));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }, { route: "unknown" }
		, { mode: "full,result-only" }, { mode: "unknown" }
		, { producer: "HEAD" }, { glibc: "2.35" }, { glibc: "2.39" }
		, { "max-load": "5" }, { "max-load": "13" }, { unknown: "value" }
	]) assert.throws(() => parseInheritedCheckedRecordNativeCiArgs(
		argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"]])
		assert.throws(() => parseInheritedCheckedRecordNativeCiArgs(invalid));
});

test("inherited native CI refuses incomplete or false successful-looking TAP", t => {
	let controls = 0;
	for(const route of ["ordinary", "reviewed"])
		for(const mode of ["full", "result-only"])
		{
			const tap = syntheticTap(route, mode);
			assertInheritedCheckedRecordNativeCiTap(tap, route, mode);
			for(const source of [
				tap.replace("TAP version 13\n", "")
				, tap.replace("ok 1 -", "not ok 1 -")
				, tap.replace("ok 1 -", "ok 2 -")
				, tap + "Bail out! stopped\n", tap + "# SKIP excluded\n"
				, tap + "# TODO later\n", tap.replace("1..1\n", "")
				, tap.replace("1..1\n", "1..2\n")
				, tap.replace("# pass 1", "# pass 0")
				, tap.replace("# Subtest:", "# Wrong:")
			]) {
				assert.throws(() => assertInheritedCheckedRecordNativeCiTap(
					source, route, mode));
				controls++;
			}
		}
	assert.equal(controls, 40);
	t.diagnostic("40 synthetic TAP bypass controls; no installed execution claimed.");
});

test("inherited native CI rejects bad scope before reading original records", async () => {
	const runtime = { platform: "linux", arch: "x64", glibc: "2.38" };
	const tap = syntheticTap("ordinary", "full"), reads = [];
	const read = async path => {
		reads.push(path);
		throw new Error("Original package records are required");
	};
	await assert.rejects(checkInheritedCheckedRecordNativeCiRecords(
		{ ...options, producer: "HEAD" }, { tap, read, runtime }), assert.AssertionError);
	await assert.rejects(checkInheritedCheckedRecordNativeCiRecords(
		options, { tap: tap.replace("# skipped 0", "# skipped 1"), read, runtime })
		, assert.AssertionError);
	await assert.rejects(checkInheritedCheckedRecordNativeCiRecords(
		options, { tap, read, runtime: { ...runtime, arch: "arm64" } })
		, assert.AssertionError);
	assert.deepEqual(reads, []);
	await assert.rejects(checkInheritedCheckedRecordNativeCiRecords(
		options, { tap, read, runtime }), /Original package records/u);
	assert.deepEqual(reads, ["report.json"]);
});
