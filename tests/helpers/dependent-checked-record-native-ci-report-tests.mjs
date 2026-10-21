/**
 * Exercise the closed hosted native checker boundary and TAP policy.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertDependentCheckedRecordNativeCiTap
	, parseDependentCheckedRecordNativeCiArgs
} from "./dependent-checked-record-native-ci-report.mjs";

const options = {
	route: "ordinary-source", producer: "1".repeat(40)
	, checker: "2".repeat(40), directory: "/records", tap: "/run.tap"
	, floor: "2.38"
};
const args = value => Object.entries(value).flatMap(
	([key, item]) => ["--" + key, item]
);

test("dependent native checker accepts only the closed identity tuple", () => {
	assert.deepEqual(
		parseDependentCheckedRecordNativeCiArgs(args(options)), options
	);
	for(const changed of [
		Object.fromEntries(Object.entries(options).slice(1))
		, { ...options, route: "unknown" }
		, { ...options, checker: "short" }
		, { ...options, floor: "current" }
		, { ...options, extra: "value" }
	])
		assert.throws(() =>
			parseDependentCheckedRecordNativeCiArgs(args(changed)));
});

test("dependent native checker rejects partial, skipped and failed TAP", () => {
	const name
		= "installed dependent records reproduce and relocate in C/C++ for ordinary-source";
	const source = "TAP version 13\n"
		+ `# Subtest: ${name}\n    1..0\nok 1 - ${name}\n`
		+ "1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n"
		+ "# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 1.25\n";
	assert.doesNotThrow(() =>
		assertDependentCheckedRecordNativeCiTap(source, "ordinary-source"));
	for(const changed of [
		source.replace("ok 1 -", "not ok 1 -")
		, source.replace("# skipped 0", "# skipped 1")
		, source.replace("1..1\n# tests 1", "1..0\n# tests 0")
		, source.replace("ordinary-source", "reviewed-ir")
	]) {
		assert.throws(() =>
			assertDependentCheckedRecordNativeCiTap(
				changed, "ordinary-source"
			)
		);
	}
});
