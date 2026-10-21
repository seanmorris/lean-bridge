/**
 * Exact Maven selections and independent Java/Kotlin callers for dependent
 * checked records: a retained `bound : Nat` with a retained `below : Fin bound`,
 * checked only by the reviewed Lean constructor and projected to a Java record
 * and a Kotlin class with two BigInteger fields.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	dependentCheckedRecordFixture, dependentCheckedRecordRoutes
	, dependentCheckedRecordSelection
} from "./dependent-checked-record-browser-fixture.mjs";

export const dependentCheckedRecordJvmRoutes = dependentCheckedRecordRoutes;
export const dependentCheckedRecordJvmFixtureRoot = dependentCheckedRecordFixture;
export const dependentCheckedRecordJvmLeanModule = "DependentRecords";
export const dependentCheckedRecordJvmProfiles = Object.freeze(["java", "kotlin"]);
export const dependentCheckedRecordJvmTarget = Object.freeze({
	name: "org.leanbridge:dependentrecords", version: "1.0.0"
});
export const dependentCheckedRecordJvmCounts = Object.freeze({
	full: Object.freeze({
		calls: 1289, checks: 2326, recoveries: 258, rejections: 258
		, snapshots: 1289
	})
	, "result-only": Object.freeze({
		calls: 513, checks: 516, recoveries: 0, rejections: 0, snapshots: 513
	})
});

/**
 * Replace only npm coordinates with one independently consumed Maven package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const dependentCheckedRecordJvmSelection = route => {
	const selected = dependentCheckedRecordSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: { maven: dependentCheckedRecordJvmTarget }
		}
	};
};

/**
 * Reject disabled explicit selections, spelling mistakes and duplicate routes.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const dependentCheckedRecordJvmEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_DEPENDENT_CHECKED_RECORD_JVM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid dependent checked-record JVM TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined)
	{
		assert.equal(flag, "1", "Explicit dependent checked-record JVM routes require TEST=1");
		assert.equal(typeof raw, "string");
	}
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const routes = raw === undefined ? [...dependentCheckedRecordJvmRoutes] : raw.split(",");
	assert.ok(routes.length
		&& routes.every(route => dependentCheckedRecordJvmRoutes.includes(route))
		&& new Set(routes).size === routes.length
	, "Invalid dependent checked-record JVM routes");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Dependent checked-record JVM max load must be 6, 8, 10, or 12");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Select only route diagnostics and full/result-only blocks from one immutable
 * public caller. Three blocks survive only in full APIs: the checked-input
 * helpers, the export-selection flag and the checked-input measurements.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Exact author/API route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const dependentCheckedRecordJvmCaller = async (
	profile, route, reader = path => readFile(path)
) => {
	assert.ok(dependentCheckedRecordJvmProfiles.includes(profile));
	const selection = dependentCheckedRecordJvmSelection(route);
	const extension = profile === "java" ? "java" : "kt";
	let source = (await reader(
		`tests/fixtures/dependent-checked-record-consumers/${profile}.${extension}`
	)).toString();
	assert.equal((source.match(/ROUTE_PREFIX/gu) ?? []).length, 1);
	source = source.replace("ROUTE_PREFIX"
		, selection.reviewed ? "value0" : "arg0");
	const pattern
		= /^[ \t]*\/\/ BEGIN FULL_ONLY\n([\s\S]*?)^[ \t]*\/\/ END FULL_ONLY\n/gmu;
	assert.equal([...source.matchAll(pattern)].length, 3);
	source = source.replace(pattern
		, (_, content) => selection.resultOnly ? "" : content);
	assert.doesNotMatch(source, /FULL_ONLY|ROUTE_PREFIX/u);
	return source;
};

/**
 * Require the exact compact receipt emitted by either independent caller.
 *
 * @param source - One JSON line.
 * @param route - Exact author/API route.
 */
export const parseDependentCheckedRecordJvmResult = (source, route) => {
	assert.equal(typeof source, "string");
	const selection = dependentCheckedRecordJvmSelection(route);
	const expected = dependentCheckedRecordJvmCounts[
		selection.resultOnly ? "result-only" : "full"
	];
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort()
		, ["calls", "checks", "recoveries", "rejections", "snapshots"]);
	assert.deepEqual(value, expected);
	return value;
};
