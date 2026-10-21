/**
 * Keep the hosted native control contract stable as history readers are added.
 *
 * @file
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	assertZeroPayloadNativeControlsTap
	, zeroPayloadNativeRequiredControlNames
} from "./zero-payload-checked-record-native-ci-report.mjs";

const tap = (extra = [], change = value => value) => {
	const results = [
		...zeroPayloadNativeRequiredControlNames.passed.map(name => ({ name }))
		, ...zeroPayloadNativeRequiredControlNames.skipped.map(name => ({
			name, skipped: true
		}))
		, ...extra.map(name => ({ name }))
	];
	const lines = ["TAP version 13"];
	for(const [offset, result] of results.entries())
	{
		const index = offset + 1;
		lines.push(`# Subtest: ${result.name}`
			, `ok ${index} - ${result.name}${result.skipped ? " # SKIP" : ""}`);
	}
	const skipped = results.filter(result => result.skipped).length;
	lines.push(`1..${results.length}`, `# tests ${results.length}`
		, "# suites 0", `# pass ${results.length - skipped}`, "# fail 0"
		, "# cancelled 0", `# skipped ${skipped}`, "# todo 0"
		, "# duration_ms 1", "");
	return change(lines.join("\n"));
};

test("zero-payload native controls retain semantic names as readers grow", () => {
	assert.deepEqual(assertZeroPayloadNativeControlsTap(tap()), {
		fastPasses: 19, skippedInstalledOrLeanTests: 7
	});
	assert.deepEqual(assertZeroPayloadNativeControlsTap(tap([
		"new authenticated history reader"
	])), { fastPasses: 20, skippedInstalledOrLeanTests: 7 });
});

test("zero-payload native controls reject missing, failed and reclassified gates", () => {
	const required = zeroPayloadNativeRequiredControlNames.passed[0];
	for(const changed of [
		tap([], source => source.replace(`# Subtest: ${required}\n`, ""))
		, tap([], source => source.replace(`ok 1 - ${required}`
			, `not ok 1 - ${required}`))
		, tap([], source => source.replace(`ok 1 - ${required}`
			, `ok 1 - ${required} # SKIP`))
		, tap([], source => source.replace("# skipped 7", "# skipped 6"))
		, tap([], source => source.slice(0, -1))
	]) assert.throws(() => assertZeroPayloadNativeControlsTap(changed));
});
