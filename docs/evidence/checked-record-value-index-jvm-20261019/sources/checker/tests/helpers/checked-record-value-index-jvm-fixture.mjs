/**
 * Exact Maven selections and independent Java/Kotlin callers for checked-record
 * value indices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexJvmRoutes
	= checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexJvmProfiles = Object.freeze([
	"java", "kotlin"
]);
export const checkedRecordValueIndexJvmTarget = Object.freeze({
	name: "org.leanbridge:checkedrecordvalueindices", version: "1.0.0"
});
export const checkedRecordValueIndexJvmCounts = Object.freeze({
	full: Object.freeze({ calls: 30, checks: 31, recoveries: 7, rejections: 7 })
	, "result-only": Object.freeze({
		calls: 8, checks: 9, recoveries: 0, rejections: 0
	})
});

/**
 * Replace only the npm coordinate with one independently consumed Maven
 * package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexJvmSelection = route => {
	const selected = checkedRecordValueIndexBrowserSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: { maven: checkedRecordValueIndexJvmTarget }
		}
	};
};

/**
 * Reject disabled explicit selections, spelling mistakes and duplicate routes.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const checkedRecordValueIndexJvmEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_VALUE_INDEX_JVM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid value-index JVM TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined)
	{
		assert.equal(flag, "1", "Explicit value-index JVM routes require TEST=1");
		assert.equal(typeof raw, "string");
	}
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const routes = raw === undefined
		? [...checkedRecordValueIndexJvmRoutes] : raw.split(",");
	assert.ok(routes.length
		&& routes.every(route => checkedRecordValueIndexJvmRoutes.includes(route))
		&& new Set(routes).size === routes.length
	, "Invalid value-index JVM routes");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Value-index JVM max load must be 6, 8, 10, or 12");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Select only the route label and full/result-only sections of an immutable
 * Java or Kotlin caller.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Exact author/API route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const checkedRecordValueIndexJvmCaller = async (
	profile, route, reader = path => readFile(path)
) => {
	assert.ok(checkedRecordValueIndexJvmProfiles.includes(profile));
	const selection = checkedRecordValueIndexJvmSelection(route);
	const extension = profile === "java" ? "java" : "kt";
	let source = (await reader(
		`tests/fixtures/checked-record-value-index-jvm/${profile}.${extension}`
	)).toString();
	assert.equal((source.match(/ROUTE_PREFIX/gu) ?? []).length, 1);
	source = source.replace("ROUTE_PREFIX"
		, selection.reviewed ? "value0" : "arg0");
	const pattern
		= /^[ \t]*\/\/ BEGIN FULL_ONLY\n([\s\S]*?)^[ \t]*\/\/ END FULL_ONLY\n/gmu;
	assert.equal([...source.matchAll(pattern)].length, 2);
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
export const parseCheckedRecordValueIndexJvmResult = (source, route) => {
	assert.equal(typeof source, "string");
	const selection = checkedRecordValueIndexJvmSelection(route);
	const expected = checkedRecordValueIndexJvmCounts[
		selection.resultOnly ? "result-only" : "full"
	];
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort()
		, ["calls", "checks", "recoveries", "rejections"]);
	assert.deepEqual(value, expected);
	return value;
};
