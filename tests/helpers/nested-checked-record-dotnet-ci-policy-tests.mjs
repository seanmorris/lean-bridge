/**
 * Refuse ambiguous CI selections and incomplete nested checked-record .NET TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertNestedCheckedRecordDotnetCiTap
	, nestedCheckedRecordDotnetCiTestName
	, parseNestedCheckedRecordDotnetCiArgs
} from "./nested-checked-record-dotnet-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary", mode: "full"
	, producer: "a".repeat(40)
	, directory: "records", tap: "run.tap"
	, glibc: "2.38", dotnet: "/runtime/dotnet"
};
const completeTap = (route, mode) => {
	const name = nestedCheckedRecordDotnetCiTestName(route, mode).replace("#", "\\#");
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
};

test("nested checked-record .NET CI selects one complete route and API mode", () => {
	const args = argsOf(options);
	assert.deepEqual(parseNestedCheckedRecordDotnetCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseNestedCheckedRecordDotnetCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseNestedCheckedRecordDotnetCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value"])
			assert.throws(() => parseNestedCheckedRecordDotnetCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }, { mode: "full,result-only" }
		, { route: "unknown" }, { mode: "unknown" }
		, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }
		, { dotnet: "dotnet" }, { unknown: "value" }
	]) assert.throws(() => parseNestedCheckedRecordDotnetCiArgs(argsOf({ ...options, ...changed })));
});

test("nested checked-record .NET CI requires exact zero-skip terminal TAP", t => {
	let controls = 0;
	for(const route of ["ordinary", "reviewed"]) for(const mode of ["full", "result-only"])
	{
		const source = completeTap(route, mode); assertNestedCheckedRecordDotnetCiTap(source, route, mode);
		for(const changed of [
			source.replace("TAP version 13\n", "")
			, source.replace("ok 1 -", "not ok 1 -")
			, source.replace("ok 1 -", "ok 2 -")
			, source.replace("1..1\n", "1..2\n")
			, source.replace("# skipped 0", "# skipped 1")
			, source.replace("# Subtest:", "# Wrong:")
			, source + "Bail out! stopped\n"
			, source + "# TODO later\n"
			, source + "incomplete\n"
		]) {
			assert.throws(() => assertNestedCheckedRecordDotnetCiTap(changed, route, mode)); controls++;
		}
		assert.throws(() => assertNestedCheckedRecordDotnetCiTap(source, route === "ordinary" ? "reviewed" : "ordinary", mode));
		assert.throws(() => assertNestedCheckedRecordDotnetCiTap(source, route, mode === "full" ? "result-only" : "full"));
		controls += 2;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped, or failed TAP controls`);
});
