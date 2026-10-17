/**
 * Exercise inherited checked-record Ruby CI admission with synthetic control transcripts.
 * These controls do not substitute for original installed package executions.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inheritedCheckedRecordRubyCiTestName, parseInheritedCheckedRecordRubyCiArgs, assertInheritedCheckedRecordRubyCiTap, checkInheritedCheckedRecordRubyCiRecords } from "./inherited-checked-record-ruby-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);
const options = { route: "ordinary", mode: "full", producer: "a".repeat(40), directory: "synthetic-records", tap: "synthetic.tap", glibc: "2.38", ruby: "/runtime/ruby" };
const syntheticTap = (route, mode) => {
	const name = inheritedCheckedRecordRubyCiTestName(route, mode);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1\n`;
};

test("inherited checked-record Ruby CI refuses unknown, duplicate and incomplete selections", () => {
	const args = argsOf(options); assert.deepEqual(parseInheritedCheckedRecordRubyCiArgs(args), options);
	assert.deepEqual(parseInheritedCheckedRecordRubyCiArgs(argsOf({ ...options, glibc: "2.36" })), { ...options, glibc: "2.36" });
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseInheritedCheckedRecordRubyCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseInheritedCheckedRecordRubyCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", null, true])
			assert.throws(() => parseInheritedCheckedRecordRubyCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [
		{ route: "ordinary,reviewed" }
		, { mode: "full,result-only" }
		, { route: "unknown" }, { mode: "unknown" }
		, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
		, { glibc: "2.35" }, { glibc: "2.39" }, { unknown: "value" }
		, { ruby: "ruby" }
		, { ruby: "/runtime/ruby\n" }
		, { ruby: "/runtime/../ruby" }])
		assert.throws(() => parseInheritedCheckedRecordRubyCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseInheritedCheckedRecordRubyCiArgs(invalid));
});

test("inherited checked-record Ruby CI refuses incomplete or false successful-looking TAP", t => {
	let controls = 0;
	for(const route of ["ordinary", "reviewed"]) for(const mode of ["full", "result-only"])
	{
		const tap = syntheticTap(route, mode);
		assertInheritedCheckedRecordRubyCiTap(tap, route, mode);
		const changed = [tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -"), tap.replace("ok 1 -", "ok 2 -")
			, tap + "Bail out! stopped\n", tap + "# SKIP excluded\n"
			, tap + "# TODO later\n", tap.replace("1..1\n", "")
			, tap.replace("1..1\n", "1..2\n"), tap + "1..1\n"
			, tap.replace("# Subtest:", "# Wrong:"), tap + "ok 2 - unrelated\n"
			, tap + tap
			, ...Object.keys({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }).flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changed)
		{
			assert.notEqual(source, tap);
			assert.throws(() => assertInheritedCheckedRecordRubyCiTap(source, route, mode)); controls++;
		}
		assert.throws(() => assertInheritedCheckedRecordRubyCiTap(tap, route === "ordinary" ? "reviewed" : "ordinary", mode));
		assert.throws(() => assertInheritedCheckedRecordRubyCiTap(tap, route, mode === "full" ? "result-only" : "full")); controls += 2;
	}
	assert.equal(controls, 140);
	t.diagnostic("140 synthetic incomplete, mismatched, skipped or failed TAP controls; no installed execution claimed.");
});

test("inherited checked-record Ruby CI rejects bad scope before reading and delegates valid selections to the full checker", async () => {
	const runtime = { platform: "linux", arch: "x64", glibc: "2.38" };
	const interpreter = { command: options.ruby
		, identity: { bytes: 1, sha256: "a".repeat(64) }
		, run: { code: 0, stderr: "", stdout: JSON.stringify({ engine: "ruby", version: "3.3.12", platform: "x86_64-linux" }) } };
	const sentinel = new Error("Original package records are required");
	for(const route of ["ordinary", "reviewed"]) for(const mode of ["full", "result-only"])
	{
		const selected = { ...options, route, mode }, tap = syntheticTap(route, mode), reads = [];
		const read = async path => { reads.push(path); throw sentinel; };
		await assert.rejects(checkInheritedCheckedRecordRubyCiRecords({ ...selected, producer: "HEAD" }, { tap, read, runtime, interpreter }), assert.AssertionError);
		await assert.rejects(checkInheritedCheckedRecordRubyCiRecords(selected, { tap: tap.replace("# skipped 0", "# skipped 1"), read, runtime, interpreter }), assert.AssertionError);
		await assert.rejects(checkInheritedCheckedRecordRubyCiRecords(selected, { tap, read, runtime: { ...runtime, arch: "arm64" }, interpreter }), assert.AssertionError);
		assert.deepEqual(reads, []);
		await assert.rejects(checkInheritedCheckedRecordRubyCiRecords(selected, { tap, read, runtime, interpreter }), error => error === sentinel);
		assert.deepEqual(reads, ["interpreter.json"]);
	}
});
