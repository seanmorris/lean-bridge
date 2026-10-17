/**
 * Closed C/C++ selections and independent inherited checked-record callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	inheritedCheckedRecordConfiguration
	, inheritedCheckedRecordModule
	, inheritedCheckedRecordReview
} from "./inherited-checked-record-fixture.mjs";

export const inheritedCheckedRecordNativeProfiles = Object.freeze(["c", "cpp"]);
export const inheritedCheckedRecordNativeRoutes = Object.freeze(["ordinary", "reviewed"]);
export const inheritedCheckedRecordNativeModes = Object.freeze(["full", "result-only"]);
export const inheritedCheckedRecordNativeCounts = Object.freeze({
	c: Object.freeze({
		full: Object.freeze({ checks: 3340, rejections: 1286, rounds: 256 })
		, "result-only": Object.freeze({ checks: 512, rejections: 0, rounds: 256 })
	})
	, cpp: Object.freeze({
		full: Object.freeze({ checks: 3340, rejections: 1286, rounds: 256 })
		, "result-only": Object.freeze({ checks: 512, rejections: 0, rounds: 256 })
	})
});
const resultNames = new Set(["produce", "produceStamped"]);

/**
 * An enabled gate always builds both public native projections.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const inheritedCheckedRecordNativeSelection = environment => {
	const prefix = "LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid inherited checked-record native TEST");
	assert.equal(environment[prefix + "PROFILES"], undefined
		, "Both C and C++ profiles are required");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid inherited checked-record native ${name}`);
			assert.equal(flag, "1"
				, `Explicit inherited checked-record native ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid inherited checked-record native ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate inherited checked-record native ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1"
			, "Explicit inherited checked-record native OUTPUT requires TEST=1");
	const configuredMaxLoad = environment[prefix + "MAX_LOAD"];
	if(configuredMaxLoad !== undefined)
		assert.equal(flag, "1"
			, "Explicit inherited checked-record native MAX_LOAD requires TEST=1");
	const maxLoad = configuredMaxLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(configuredMaxLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Inherited checked-record native max load must be 6, 8, 10, or 12");
	return {
		enabled: flag === "1", profiles: inheritedCheckedRecordNativeProfiles
		, routes: select("ROUTES", inheritedCheckedRecordNativeRoutes)
		, modes: select("MODES", inheritedCheckedRecordNativeModes), maxLoad
	};
};

/**
 * Select one ordinary or reviewed full/result-only C/C++ package.
 *
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordNativeConfiguration = (route, mode) => {
	assert.ok(inheritedCheckedRecordNativeRoutes.includes(route));
	assert.ok(inheritedCheckedRecordNativeModes.includes(mode));
	const configuration = inheritedCheckedRecordConfiguration(
		route, inheritedCheckedRecordNativeProfiles
	);
	if(mode === "full" || route === "reviewed") return configuration;
	const exports = configuration.exports.filter(name =>
		resultNames.has(name.split(".").at(-1)));
	const contracts = Object.fromEntries(Object.entries(
		configuration.contracts ?? {}
	).filter(([name]) => resultNames.has(name.split(".").at(-1))));
	const result = { ...configuration, exports, contracts };
	if(!Object.keys(contracts).length) delete result.contracts;
	return result;
};

/**
 * Exact independent reviewed IR for one public API mode.
 *
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordNativeReview = mode => {
	assert.ok(inheritedCheckedRecordNativeModes.includes(mode));
	const review = inheritedCheckedRecordReview();
	if(mode === "full") return review;
	review.declarations = review.declarations.filter(item => resultNames.has(item.name));
	review.types = review.types.filter(type => type.name !== "TicketAlias");
	return review;
};

/**
 * Add only route/mode selectors to the independent checked-in caller.
 *
 * @param profile - C or C++ public API.
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordNativeCaller = async (profile, route, mode) => {
	assert.ok(inheritedCheckedRecordNativeProfiles.includes(profile));
	assert.ok(inheritedCheckedRecordNativeRoutes.includes(route));
	assert.ok(inheritedCheckedRecordNativeModes.includes(mode));
	const source = await readFile(
		`tests/fixtures/inherited-checked-record-consumers/${profile}.${profile}`
		, "utf8");
	return inheritedCheckedRecordNativeCallerDirectives(route, mode) + source;
};

/**
 * Prepend-only preprocessor directives that select one route and API mode.
 * The producer and the independent report checker share this single spelling.
 *
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const inheritedCheckedRecordNativeCallerDirectives = (route, mode) => {
	assert.ok(inheritedCheckedRecordNativeRoutes.includes(route));
	assert.ok(inheritedCheckedRecordNativeModes.includes(mode));
	return (mode === "result-only"
		? "#define INHERITED_CHECKED_RECORD_RESULT_ONLY\n" : "")
		+ (route === "reviewed"
			? '#define INHERITED_PARAMETER_PREFIX "value"\n' : "");
};

/**
 * Require every independently fixed check and rejection total.
 *
 * @param stdout - Original caller stdout.
 * @param profile - C or C++ public API.
 * @param mode - Full or result-only API.
 */
export const parseInheritedCheckedRecordNativeResult = (
	stdout, profile, mode
) => {
	assert.ok(inheritedCheckedRecordNativeProfiles.includes(profile));
	assert.ok(inheritedCheckedRecordNativeModes.includes(mode));
	const value = JSON.parse(stdout);
	assert.deepEqual(value, inheritedCheckedRecordNativeCounts[profile][mode]);
	return value;
};

export { inheritedCheckedRecordModule };
