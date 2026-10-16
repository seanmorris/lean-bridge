/**
 * Closed CPAN selections and one immutable nested checked-record Perl caller.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	nestedCheckedRecordConfiguration
	, nestedCheckedRecordReview
} from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordPerlRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordPerlModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordPerlModule = "LeanBridge::NestedCheckedRecords";
export const nestedCheckedRecordPerlExpected = Object.freeze({
	full: Object.freeze({
		checks: 4762, rejections: 524, hostRejections: 4
		, recoveries: 528, snapshots: 1060
	})
	, "result-only": Object.freeze({
		checks: 1571, rejections: 0, hostRejections: 1
		, recoveries: 1, snapshots: 520
	})
});

/**
 * Select one ordinary or reviewed full/result-only CPAN package.
 *
	 * @param route - Ordinary or independently reviewed author route.
	 * @param mode - Full input/output API or result-only API.
 */
export const nestedCheckedRecordPerlConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordPerlRoutes.includes(route));
	assert.ok(nestedCheckedRecordPerlModes.includes(mode));
	return {
		...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: {
			cpan: { module: nestedCheckedRecordPerlModule, version: "1.000" }
		}
	};
};

const selectBlock = (source, name, selected) => {
	const pattern = new RegExp(`^# BEGIN ${name}\\n([\\s\\S]*?)^# END ${name}\\n`, "gmu");
	assert.equal([...source.matchAll(pattern)].length, 1, `Missing ${name} caller section`);
	return source.replace(pattern, (_, body) => selected ? body : "");
};

/**
 * Select only route labels and the declared API section in the checked-in caller.
 *
	 * @param route - Ordinary or independently reviewed author route.
	 * @param mode - Full input/output API or result-only API.
 */
export const nestedCheckedRecordPerlCaller = async (route, mode) => {
	assert.ok(nestedCheckedRecordPerlRoutes.includes(route));
	assert.ok(nestedCheckedRecordPerlModes.includes(mode));
	let source = await readFile(
		"tests/fixtures/nested-checked-record-consumers/perl.pl", "utf8"
	);
	assert.ok((source.match(/ROUTE_PREFIX/gu) ?? []).length > 10);
	source = source.replaceAll("ROUTE_PREFIX", route === "ordinary" ? "arg" : "value");
	source = selectBlock(source, "FULL_ONLY", mode === "full");
	source = selectBlock(source, "RESULT_ONLY", mode === "result-only");
	assert.doesNotMatch(source, /ROUTE_PREFIX|BEGIN (?:FULL|RESULT)_ONLY|END (?:FULL|RESULT)_ONLY/u);
	return source;
};

/**
 * Require the stable execution envelope before selection-specific count checks.
 *
	 * @param source - Canonical JSON emitted by the installed Perl caller.
 */
export const parseNestedCheckedRecordPerlResult = source => {
	assert.equal(typeof source, "string");
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort(), [
		"api", "checks", "hostRejections", "nativeLibraries", "perl", "recoveries"
		, "rejections", "rounds", "snapshots", "threaded", "wordBits"
	]);
	for(const name of ["checks", "hostRejections", "recoveries", "rejections", "snapshots"])
		assert.ok(Number.isSafeInteger(value[name]) && value[name] >= 0, name);
	assert.equal(value.rounds, 256); assert.equal(value.wordBits, 64);
	assert.match(value.perl, /^v5\.(?:36|38)\.\d+$/u);
	assert.equal(typeof value.threaded, "boolean");
	assert.equal(typeof value.api, "string"); assert.ok(value.api.endsWith("/LeanBridge/NestedCheckedRecords.pm"));
	assert.ok(value.nativeLibraries && Object.getPrototypeOf(value.nativeLibraries) === Object.prototype);
	assert.ok(Object.keys(value.nativeLibraries).length >= 2);
	for(const [path, digest] of Object.entries(value.nativeLibraries))
	{
		assert.match(path, /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+$/u);
		assert.match(digest, /^[a-f0-9]{64}$/u);
	}
	return value;
};

/**
 * Require exact workload counts and one installed API for the selected package.
 *
 * @param value - Parsed installed caller result.
 * @param mode - Full input/output API or result-only API.
 */
export const assertNestedCheckedRecordPerlResult = (value, mode) => {
	assert.ok(nestedCheckedRecordPerlModes.includes(mode));
	const expected = nestedCheckedRecordPerlExpected[mode];
	for(const [name, count] of Object.entries(expected)) assert.equal(value[name], count, name);
	assert.equal(value.rounds, 256); assert.equal(value.wordBits, 64);
	assert.ok(Object.keys(value.nativeLibraries).some(path => /Runtime/u.test(path)));
	assert.ok(Object.keys(value.nativeLibraries).some(path => /NestedCheckedRecords/u.test(path)));
	return value;
};

/** Exact independently authored reviewed IR for the selected API mode. */
export const nestedCheckedRecordPerlReview = nestedCheckedRecordReview;
