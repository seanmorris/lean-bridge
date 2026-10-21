/**
 * Refuse ambiguous JVM CI selections and incomplete producer TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertDependentCheckedRecordJvmCiTap
	, dependentCheckedRecordJvmCiTestName
	, parseDependentCheckedRecordJvmCiArgs
} from "./dependent-checked-record-jvm-ci-report.mjs";
import {
	dependentCheckedRecordJvmRoutes
} from "./dependent-checked-record-jvm-fixture.mjs";

const argsOf = options => Object.entries(options)
	.flatMap(([key, value]) => ["--" + key, value]);
const options = {
	route: "ordinary-source", producer: "a".repeat(40)
	, consumer: "b".repeat(40), directory: "records", tap: "run.tap"
	, glibc: "2.38", java: "/runtime/java", javac: "/runtime/javac"
	, kotlinc: "/runtime/kotlinc"
};
const completeTap = route => {
	const name = dependentCheckedRecordJvmCiTestName(route);
	return `TAP version 13\n# Subtest: ${name}\nok 1 - ${name}\n  ---\n  duration_ms: 1\n  type: 'test'\n  ...\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 2\n`;
};

test("dependent checked-record JVM CI selects one route and two exact revisions", () => {
	const args = argsOf(options);
	assert.deepEqual(parseDependentCheckedRecordJvmCiArgs(args), options);
	for(const key of Object.keys(options))
	{
		assert.throws(() => parseDependentCheckedRecordJvmCiArgs(argsOf(
			Object.fromEntries(Object.entries(options)
				.filter(([name]) => name !== key))
		)));
		assert.throws(() => parseDependentCheckedRecordJvmCiArgs([
			...args, "--" + key, options[key]
		]));
		for(const value of ["", "--other", "bad\0value"])
			assert.throws(() => parseDependentCheckedRecordJvmCiArgs(
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
	]) assert.throws(() => parseDependentCheckedRecordJvmCiArgs(
		argsOf({ ...options, ...changed })
	));
});
test("dependent checked-record JVM CI requires exact zero-skip terminal TAP", t => {
	let controls = 0;
	for(const route of dependentCheckedRecordJvmRoutes)
	{
		const source = completeTap(route);
		assertDependentCheckedRecordJvmCiTap(source, route);
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
				assertDependentCheckedRecordJvmCiTap(changed, route));
			controls++;
		}
		const other = dependentCheckedRecordJvmRoutes.find(
			candidate => candidate !== route
		);
		assert.throws(() =>
			assertDependentCheckedRecordJvmCiTap(source, other));
		controls++;
	}
	t.diagnostic(`${controls} incomplete, mismatched, skipped, or failed TAP controls`);
});
