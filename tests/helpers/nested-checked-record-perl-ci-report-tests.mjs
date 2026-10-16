/**
 * Closed option, TAP and retained-path controls for nested checked-record Perl CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertNestedCheckedRecordPerlCiTap
	, nestedCheckedRecordPerlCases
	, nestedCheckedRecordPerlRecordPaths
	, parseNestedCheckedRecordPerlCiArgs
} from "./nested-checked-record-perl-ci-report.mjs";

const tap = name => `TAP version 13
# Subtest: installed nested checked-record Perl packages reproduce and relocate for ${name}
ok 1 - installed nested checked-record Perl packages reproduce and relocate for ${name}
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
`;

test("nested checked-record Perl CI accepts one exact zero-skip TAP cell", () => {
	for(const name of nestedCheckedRecordPerlCases)
	{
		assert.doesNotThrow(() => assertNestedCheckedRecordPerlCiTap(tap(name), name));
		const paths = nestedCheckedRecordPerlRecordPaths(name);
		assert.equal(paths.length, name.startsWith("reviewed-") ? 110 : 108);
		assert.equal(new Set(paths).size, paths.length);
		assert.deepEqual(paths, [...paths].sort());
	}
	for(const changed of [
		tap("ordinary-full").replace("ok 1", "not ok 1")
		, tap("ordinary-full").replace("# skipped 0", "# skipped 1")
		, tap("ordinary-full").replace("# pass 1", "# pass 0")
		, tap("ordinary-full") + "ok 2 - substituted\n"
		, tap("ordinary-full").replace("ordinary-full", "reviewed-full")
	]) assert.throws(() => assertNestedCheckedRecordPerlCiTap(changed, "ordinary-full"));
});

test("nested checked-record Perl CI options close every field", () => {
	const args = [
		"--name", "ordinary-full", "--producer", "a".repeat(40)
		, "--directory", "records", "--tap", "run.tap", "--glibc", "2.38"
	];
	assert.deepEqual(parseNestedCheckedRecordPerlCiArgs(args), {
		name: "ordinary-full", producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", glibc: "2.38"
	});
	for(const changed of [
		args.slice(2), [...args, "extra"], args.with(1, "unknown")
		, args.with(3, "short"), args.with(9, "2.39")
		, args.with(2, "--name"), args.with(5, "--tap")
	]) assert.throws(() => parseNestedCheckedRecordPerlCiArgs(changed));
});
