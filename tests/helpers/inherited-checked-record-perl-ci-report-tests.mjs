/**
 * Source-only controls for the inherited checked-record Perl CI checker.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertInheritedCheckedRecordPerlCiTap
	, inheritedCheckedRecordPerlCase
	, inheritedCheckedRecordPerlCases
	, inheritedCheckedRecordPerlCiTestName
	, inheritedCheckedRecordPerlRecordPaths
	, parseInheritedCheckedRecordPerlCiArgs
} from "./inherited-checked-record-perl-ci-report.mjs";
import {
	inheritedCheckedRecordPerlStdout
} from "./inherited-checked-record-perl-records.mjs";

const tap = (route, mode) => {
	const title = inheritedCheckedRecordPerlCiTestName(route, mode);
	return `TAP version 13\n# Subtest: ${title}\nok 1 - ${title}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
};

const args = (route = "ordinary", mode = "full") => [
	"--route", route, "--mode", mode, "--producer", "a".repeat(40)
	, "--directory", "/records", "--tap", "/run.tap"
	, "--glibc", "2.38", "--max-load", "8"
];

test("inherited checked-record Perl CI closes all four selections and records", () => {
	assert.equal(inheritedCheckedRecordPerlStdout({
		z: [2, { z: 1, a: 0 }], a: 1
	}), '{"a":1,"z":[2,{"a":0,"z":1}]}\n');
	assert.deepEqual(inheritedCheckedRecordPerlCases, [
		"ordinary-full", "ordinary-result-only"
		, "reviewed-full", "reviewed-result-only"
	]);
	for(const name of inheritedCheckedRecordPerlCases)
	{
		const { route, mode } = inheritedCheckedRecordPerlCase(name);
		assertInheritedCheckedRecordPerlCiTap(tap(route, mode), route, mode);
		const paths = inheritedCheckedRecordPerlRecordPaths(route, mode);
		assert.equal(new Set(paths).size, paths.length);
		assert.equal(paths.length, route === "reviewed" ? 131 : 129);
		assert.ok(paths.includes("interpreters.json"));
		for(const configuration of [
			"5.36.3-threaded", "5.36.3-unthreaded"
			, "5.38.2-threaded", "5.38.2-unthreaded"
		]) for(const installMode of ["prebuilt-only", "build-xs"])
			assert.ok(paths.includes(
				`${configuration}/${installMode}/report.json`
			));
		assert.deepEqual(parseInheritedCheckedRecordPerlCiArgs(
			args(route, mode)
		), {
			route, mode, producer: "a".repeat(40), directory: "/records"
			, tap: "/run.tap", glibc: "2.38", maxLoad: 8
		});
	}
	assert.throws(() => inheritedCheckedRecordPerlCase(
		"ordinary-result"
	));
});

test("inherited checked-record Perl CI refuses incomplete TAP and options", () => {
	const validTap = tap("ordinary", "full");
	for(const mutate of [
		value => value.replace("# pass 1", "# pass 0")
		, value => value.replace("# fail 0", "# fail 1")
		, value => value.replace("# skipped 0", "# skipped 1")
		, value => value.replace("ok 1 -", "not ok 1 -")
		, value => value.replace("1..1", "1..0")
		, value => value + "ok 2 - duplicate\n"
	]) assert.throws(() => assertInheritedCheckedRecordPerlCiTap(
		mutate(validTap), "ordinary", "full"
	));
	const validArgs = args();
	for(const changed of [
		validArgs.slice(0, -2)
		, [...validArgs, "--extra", "x"]
		, validArgs.map(value => value === "2.38" ? "2.37" : value)
		, validArgs.map(value => value === "ordinary" ? "unknown" : value)
		, validArgs.map(value => value === "full" ? "unknown" : value)
		, validArgs.map(value => value === "8" ? "6" : value)
		, validArgs.map(value => value === "a".repeat(40) ? "short" : value)
		, ["--route", "ordinary", ...validArgs]
	]) assert.throws(() => parseInheritedCheckedRecordPerlCiArgs(changed));
});
