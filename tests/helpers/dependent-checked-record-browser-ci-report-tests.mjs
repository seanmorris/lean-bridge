/**
 * Exercise the closed hosted browser checker boundary and TAP policy.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertDependentCheckedRecordBrowserCiTap
	, parseDependentCheckedRecordBrowserCiArgs
} from "./dependent-checked-record-browser-ci-report.mjs";
import {
	dependentCheckedRecordRoutes
} from "./dependent-checked-record-browser-fixture.mjs";

const options = {
	route: "ordinary-source", producer: "1".repeat(40)
	, checker: "2".repeat(40), directory: "/records", tap: "/run.tap"
};
const args = value => Object.entries(value).flatMap(
	([key, item]) => ["--" + key, item]
);

test("dependent browser checker accepts only the closed identity tuple", () => {
	assert.deepEqual(
		parseDependentCheckedRecordBrowserCiArgs(args(options)), options
	);
	for(const changed of [
		Object.fromEntries(Object.entries(options).slice(1))
		, { ...options, route: "unknown" }
		, { ...options, checker: "short" }
		, { ...options, extra: "value" }
	])
		assert.throws(() =>
			parseDependentCheckedRecordBrowserCiArgs(args(changed)));
});

test("dependent browser checker rejects partial, skipped and failed TAP", () => {
	const names = dependentCheckedRecordRoutes.map(route =>
		`installed dependent checked records reproduce and relocate ${route}`);
	const source = "TAP version 13\n"
		+ names.map((name, index) =>
			`# Subtest: ${name}\n    1..0\nok ${index + 1} - ${name}\n`
		).join("")
		+ "1..4\n# tests 4\n# suites 0\n# pass 4\n# fail 0\n"
		+ "# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1.25\n";
	assert.doesNotThrow(() =>
		assertDependentCheckedRecordBrowserCiTap(source));
	for(const changed of [
		source.replace("ok 2 -", "not ok 2 -")
		, source.replace("# skipped 0", "# skipped 1")
		, source.replace("1..4\n# tests 4", "1..3\n# tests 3")
		, source.replace(names[2], "substituted route")
	])
		assert.throws(() =>
			assertDependentCheckedRecordBrowserCiTap(changed));
});
