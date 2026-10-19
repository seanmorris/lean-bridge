/**
 * Refuse ambiguous JVM CI selections and incomplete producer TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertCheckedRecordValueIndexJvmCiTap
	, checkedRecordValueIndexJvmCiTestName
	, parseCheckedRecordValueIndexJvmCiArgs
} from "./checked-record-value-index-jvm-ci-report.mjs";
import {
	checkedRecordValueIndexJvmRoutes
} from "./checked-record-value-index-jvm-fixture.mjs";

const argsOf = options => Object.entries(options)
	.flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary-source", producer: "a".repeat(40)
	, consumer: "b".repeat(40), directory: "records", tap: "run.tap"
	, glibc: "2.38", java: "/runtime/java", javac: "/runtime/javac"
	, kotlinc: "/runtime/kotlinc"
};
const completeTap = route => {
	const name = checkedRecordValueIndexJvmCiTestName(route);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
};

test("value-index JVM CI selects one route and two exact revisions", () => {
	const args = argsOf(options);
	assert.deepEqual(parseCheckedRecordValueIndexJvmCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseCheckedRecordValueIndexJvmCiArgs(argsOf(
			Object.fromEntries(Object.entries(options)
				.filter(([name]) => name !== key))
		)));
		assert.throws(() => parseCheckedRecordValueIndexJvmCiArgs([
			...args, "--" + key, options[key]
		]));
		for(const value of ["", "--other", "bad\0value"])
			assert.throws(() => parseCheckedRecordValueIndexJvmCiArgs(
				argsOf({ ...options, [key]: value })
			));
	}
	for(const changed of [
		{ route: "ordinary-source,reviewed-ir" }, { route: "unknown" }
		, { producer: "a".repeat(39) }, { producer: "G".repeat(40) }
		, { consumer: "b".repeat(39) }, { consumer: "G".repeat(40) }
		, { glibc: "2.36" }, { glibc: "2.39" }
		, { java: "java" }, { javac: "javac" }, { kotlinc: "kotlinc" }
		, { unknown: "value" }
	]) assert.throws(() => parseCheckedRecordValueIndexJvmCiArgs(
		argsOf({ ...options, ...changed })
	));
});

test("value-index JVM CI requires exact zero-skip terminal TAP", t => {
	let controls = 0;
	for(const route of checkedRecordValueIndexJvmRoutes)
	{
		const source = completeTap(route);
		assertCheckedRecordValueIndexJvmCiTap(source, route);
		for(const changed of [
			source.replace("TAP version 13\n", "")
			, source.replace("ok 1 -", "not ok 1 -")
			, source.replace("ok 1 -", "ok 2 -")
			, source.replace("1..1\n", "1..2\n")
			, source.replace("# skipped 0", "# skipped 1")
			, source.replace("# Subtest:", "# Wrong:")
			, source + "Bail out! stopped\n"
			, source + "# TODO later\n", source + "incomplete\n"
		]) {
			assert.throws(() =>
				assertCheckedRecordValueIndexJvmCiTap(changed, route));
			controls++;
		}
		const other = checkedRecordValueIndexJvmRoutes.find(
			candidate => candidate !== route
		);
		assert.throws(() =>
			assertCheckedRecordValueIndexJvmCiTap(source, other));
		controls++;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped, or failed TAP controls`);
});
