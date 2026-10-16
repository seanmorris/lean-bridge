/**
 * Closed C/C++ selections and independent nested checked-record callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	nestedCheckedRecordConfiguration,
	nestedCheckedRecordReview
} from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordNativeProfiles = Object.freeze(["c", "cpp"]);
export const nestedCheckedRecordNativeRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordNativeModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordNativeCounts = Object.freeze({
	c: Object.freeze({
		full: Object.freeze({ checks: 3369, rejections: 524, recoveries: 256
			, snapshots: 1294, rounds: 256 })
		, "result-only": Object.freeze({ checks: 768, rejections: 0, recoveries: 0
			, snapshots: 0, rounds: 256 })
	})
	, cpp: Object.freeze({
		full: Object.freeze({ checks: 3884, rejections: 526, recoveries: 256
			, snapshots: 1296, rounds: 256 })
		, "result-only": Object.freeze({ checks: 1280, rejections: 0, recoveries: 0
			, snapshots: 0, rounds: 256 })
	})
});

/**
 * An enabled gate always builds both public native projections.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nestedCheckedRecordNativeSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_NATIVE_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid nested checked-record native TEST");
	assert.equal(environment[prefix + "PROFILES"], undefined
		, "Both C and C++ profiles are required");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string", `Invalid nested checked-record native ${name}`);
			assert.equal(flag, "1"
				, `Explicit nested checked-record native ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid nested checked-record native ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate nested checked-record native ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1", "Explicit nested checked-record native OUTPUT requires TEST=1");
	const configuredMaxLoad = environment[prefix + "MAX_LOAD"];
	if(configuredMaxLoad !== undefined)
		assert.equal(flag, "1"
			, "Explicit nested checked-record native MAX_LOAD requires TEST=1");
	const maxLoad = configuredMaxLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(configuredMaxLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Nested checked-record native max load must be 6, 8, 10, or 12");
	return {
		enabled: flag === "1", profiles: nestedCheckedRecordNativeProfiles
		, routes: select("ROUTES", nestedCheckedRecordNativeRoutes)
		, modes: select("MODES", nestedCheckedRecordNativeModes), maxLoad
	};
};

/**
 * Select one ordinary or reviewed full/result-only C/C++ package.
 *
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const nestedCheckedRecordNativeConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordNativeRoutes.includes(route));
	assert.ok(nestedCheckedRecordNativeModes.includes(mode));
	return nestedCheckedRecordConfiguration(
		route, nestedCheckedRecordNativeProfiles, mode
	);
};

/**
 * Add only route/mode selectors to the independent checked-in caller.
 *
 * @param profile - C or C++ public API.
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const nestedCheckedRecordNativeCaller = async (profile, route, mode) => {
	assert.ok(nestedCheckedRecordNativeProfiles.includes(profile));
	assert.ok(nestedCheckedRecordNativeRoutes.includes(route));
	assert.ok(nestedCheckedRecordNativeModes.includes(mode));
	const source = await readFile(
		`tests/fixtures/nested-checked-record-consumers/${profile}.${profile}`, "utf8");
	return (mode === "result-only" ? "#define NESTED_CHECKED_RECORD_RESULT_ONLY\n" : "")
		+ (route === "reviewed" ? '#define NESTED_PARAMETER_PREFIX "value"\n' : "")
		+ source;
};

/**
 * Require every independently fixed check, rejection and recovery total.
 *
 * @param stdout - Original caller stdout.
 * @param profile - C or C++ public API.
 * @param mode - Full or result-only API.
 */
export const parseNestedCheckedRecordNativeResult = (stdout, profile, mode) => {
	assert.ok(nestedCheckedRecordNativeProfiles.includes(profile));
	assert.ok(nestedCheckedRecordNativeModes.includes(mode));
	const value = JSON.parse(stdout);
	assert.deepEqual(value, nestedCheckedRecordNativeCounts[profile][mode]);
	return value;
};

/** Exact reviewed IR for the selected API mode. */
export const nestedCheckedRecordNativeReview = nestedCheckedRecordReview;
