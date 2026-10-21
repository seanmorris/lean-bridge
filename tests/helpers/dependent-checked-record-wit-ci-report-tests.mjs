/**
 * Check dependent checked-record checked-record WIT CI argument and TAP gates without original execution records.
 * Archive-bound record controls join with the retained evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import { assertDependentCheckedRecordWitCiTap, dependentCheckedRecordWitCiTestName, parseDependentCheckedRecordWitCiArgs } from "./dependent-checked-record-wit-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);

test("dependent checked-record checked-record WIT CI rejects unknown, repeated and incomplete selections", () => {
	const options = { route: "ordinary-source", mode: "full"
		, producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", glibc: "2.38"
		, cc: "/selected/cc"
		, "wasm-tools": "/selected/wasm-tools"
		, "wasmtime-capi": "/selected/capi" };
	const args = argsOf(options); assert.deepEqual(parseDependentCheckedRecordWitCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseDependentCheckedRecordWitCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
		assert.throws(() => parseDependentCheckedRecordWitCiArgs([...args, "--" + key, options[key]]));
		for(const value of ["", "--other", "bad\0value", "bad\nvalue", "bad\rvalue"])
			assert.throws(() => parseDependentCheckedRecordWitCiArgs(argsOf({ ...options, [key]: value })));
	}
	for(const changed of [{ route: "ordinary-source,reviewed-ir" }
		, { mode: "full,result-only" }
		, { route: "unknown" }, { mode: "unknown" }, { producer: "a".repeat(39) }
		, { producer: "G".repeat(40) }, { glibc: "2.35" }, { glibc: "2.39" }
		, { cc: "cc" }
		, { "wasm-tools": "wasm-tools" }
		, { "wasmtime-capi": "capi" }
		, { unknown: "value" }])
		assert.throws(() => parseDependentCheckedRecordWitCiArgs(argsOf({ ...options, ...changed })));
	for(const invalid of [undefined, {}, [], [...args, "--route"], ["route", ...args.slice(1)]])
		assert.throws(() => parseDependentCheckedRecordWitCiArgs(invalid));
});

test("dependent checked-record checked-record WIT CI requires complete zero-skip TAP for each exact selection", t => {
	let controls = 0;
	for(const route of ["ordinary-source", "reviewed-ir"
		, "result-only-ordinary-source", "result-only-reviewed-ir"]) {
		const mode = route.startsWith("result-only-") ? "result-only" : "full";
		const name = dependentCheckedRecordWitCiTestName(route, mode);
		assert.equal(name, `installed dependent checked records reproduce and relocate in WIT for ${route}`);
		const tap = `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1.5\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
		assertDependentCheckedRecordWitCiTap(tap, route, mode);
		const changes = [tap.replace("TAP version 13\n", "")
			, tap.replace("ok 1 -", "not ok 1 -"), tap.replace("ok 1 -", "ok 2 -")
			, tap + "Bail out! stopped\n"
			, tap + "# SKIP excluded\n"
			, tap + "# TODO later\n"
			, tap.replace("1..1\n", ""), tap.replace("1..1\n", "1..2\n"), tap + "1..1\n"
			, tap.replace("# Subtest:", "# Wrong:")
			, tap + "ok 2 - unrelated\n"
			, tap + tap
			, tap + "incomplete\n"
			, tap.replace(/^# duration_ms [^\n]+\n$/mu, "")
			, ...["not ok 1 - hidden failure", "ok 1 - hidden pass", "# Subtest: hidden", "Bail out! stopped"]
				.map(line => tap.replace("\n1..1\n", `\n    ${line}\n1..1\n`))
			, ...["tests", "suites", "pass", "fail", "cancelled", "skipped", "todo"].flatMap(key => [
				tap.replace(new RegExp(`^# ${key} \\d+\\n`, "mu"), "")
				, tap.replace(new RegExp(`^# ${key} \\d+$`, "mu"), `# ${key} 7`)
				, tap + `# ${key} 0\n`
			])
		];
		for(const source of changes)
		{ assert.notEqual(source, tap); assert.throws(() => assertDependentCheckedRecordWitCiTap(source, route, mode)); controls++; }
		const other = route.includes("ordinary") ? route.replace("ordinary-source", "reviewed-ir")
			: route.replace("reviewed-ir", "ordinary-source");
		assert.throws(() => assertDependentCheckedRecordWitCiTap(tap, other, mode));
		assert.throws(() => assertDependentCheckedRecordWitCiTap(tap, route, mode === "full" ? "result-only" : "full")); controls += 2;
		}
	assert.equal(controls, 164); t.diagnostic(`${controls} incomplete, mismatched, skipped or failed TAP controls`);
});
