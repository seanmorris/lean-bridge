/**
 * Closed option, TAP and retained-path controls for recursive checked-record Perl CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertRecursiveCheckedRecordPerlCiTap
	, parseRecursiveCheckedRecordPerlCiArgs
	, recursiveCheckedRecordPerlCases
	, recursiveCheckedRecordPerlRecordPaths
} from "./recursive-checked-record-perl-ci-report.mjs";

const tap = name => {
	const [route, fixture] = name.split("-");
	const title = `installed recursive checked-record Perl packages reproduce and relocate ${route} ${fixture}`;
	return `TAP version 13
# Subtest: ${title}
ok 1 - ${title}
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;
};

test("recursive checked-record Perl CI accepts one exact zero-skip TAP cell", () => {
	for(const name of recursiveCheckedRecordPerlCases)
	{
		assert.doesNotThrow(() => assertRecursiveCheckedRecordPerlCiTap(tap(name), name));
		const paths = recursiveCheckedRecordPerlRecordPaths(name);
		assert.equal(paths.length, name.startsWith("reviewed-") ? 130 : 128);
		assert.equal(new Set(paths).size, paths.length); assert.deepEqual(paths, [...paths].sort());
	}
	for(const changed of [
		tap("ordinary-recursive").replace("ok 1", "not ok 1")
		, tap("ordinary-recursive").replace("# skipped 0", "# skipped 1")
		, tap("ordinary-recursive").replace("# pass 1", "# pass 0")
		, tap("ordinary-recursive") + "ok 2 - substituted\n"
		, tap("ordinary-recursive").replaceAll("ordinary recursive", "reviewed recursive")
	]) assert.throws(() => assertRecursiveCheckedRecordPerlCiTap(changed, "ordinary-recursive"));
});

test("recursive checked-record Perl CI options close every field", () => {
	const args = [
		"--name", "ordinary-recursive", "--producer", "a".repeat(40)
		, "--directory", "records", "--tap", "run.tap", "--glibc", "2.38"
		, "--max-load", "8"
	];
	assert.deepEqual(parseRecursiveCheckedRecordPerlCiArgs(args), {
		name: "ordinary-recursive", producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", glibc: "2.38", maxLoad: 8
	});
	for(const changed of [
		args.slice(2), [...args, "extra"], args.with(1, "unknown")
		, args.with(3, "short"), args.with(9, "2.39"), args.with(11, "7")
		, args.with(2, "--name"), args.with(5, "--tap")
	]) assert.throws(() => parseRecursiveCheckedRecordPerlCiArgs(changed));
});
