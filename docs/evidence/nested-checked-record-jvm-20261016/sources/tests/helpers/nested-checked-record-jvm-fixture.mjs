/**
 * Closed Maven selections and independent Java/Kotlin nested checked-record callers.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	nestedCheckedRecordConfiguration
	, nestedCheckedRecordReview
} from "./nested-checked-record-fixture.mjs";

export const nestedCheckedRecordJvmRoutes = Object.freeze(["ordinary", "reviewed"]);
export const nestedCheckedRecordJvmModes = Object.freeze(["full", "result-only"]);
export const nestedCheckedRecordJvmProfiles = Object.freeze(["java", "kotlin"]);
export const nestedCheckedRecordJvmMavenName
	= "org.leanbridge:nestedcheckedrecords";
export const nestedCheckedRecordJvmCounts = Object.freeze(Object.fromEntries(
	nestedCheckedRecordJvmProfiles.map(profile => [
		profile
		, Object.freeze({
			full: Object.freeze({
				checks: 3924, rejections: 524, hostRejections: 7
				, recoveries: 528, snapshots: 1054, rounds: 256, wordBits: 64
			})
			, "result-only": Object.freeze({
				checks: 1290, rejections: 0, hostRejections: 4
				, recoveries: 1, snapshots: 1, rounds: 256, wordBits: 64
			})
		})
	])
));

/**
 * Reject disabled explicit selections, unknown values and duplicate work.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const nestedCheckedRecordJvmSelection = environment => {
	const prefix = "LEAN_BRIDGE_NESTED_CHECKED_RECORD_JVM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid nested checked-record JVM TEST");
	const select = (name, permitted) => {
		const raw = environment[prefix + name];
		if(raw !== undefined)
		{
			assert.equal(typeof raw, "string"
				, `Invalid nested checked-record JVM ${name}`);
			assert.equal(flag, "1"
				, `Explicit nested checked-record JVM ${name} requires TEST=1`);
		}
		const selected = raw === undefined ? permitted : raw.split(",");
		assert.ok(selected.length && selected.every(value => permitted.includes(value))
			, `Invalid nested checked-record JVM ${name}`);
		assert.equal(new Set(selected).size, selected.length
			, `Duplicate nested checked-record JVM ${name}`);
		return selected;
	};
	if(environment[prefix + "OUTPUT"] !== undefined)
		assert.equal(flag, "1"
			, "Explicit nested checked-record JVM OUTPUT requires TEST=1");
	const configuredMaxLoad = environment[prefix + "MAX_LOAD"];
	if(configuredMaxLoad !== undefined)
		assert.equal(flag, "1"
			, "Explicit nested checked-record JVM MAX_LOAD requires TEST=1");
	const maxLoad = configuredMaxLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(configuredMaxLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Nested checked-record JVM max load must be 6, 8, 10, or 12");
	return {
		enabled: flag === "1"
		, routes: select("ROUTES", nestedCheckedRecordJvmRoutes)
		, modes: select("MODES", nestedCheckedRecordJvmModes), maxLoad
	};
};

/**
 * Select one ordinary or reviewed full/result-only Maven package.
 *
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const nestedCheckedRecordJvmConfiguration = (route, mode) => {
	assert.ok(nestedCheckedRecordJvmRoutes.includes(route));
	assert.ok(nestedCheckedRecordJvmModes.includes(mode));
	return {
		...nestedCheckedRecordConfiguration(route, ["c"], mode)
		, targets: {
			maven: { name: nestedCheckedRecordJvmMavenName, version: "1.0.0" }
		}
	};
};

/**
 * Select the immutable caller's route prefix and compile-time API section.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Ordinary or reviewed source.
 * @param mode - Full or result-only API.
 */
export const nestedCheckedRecordJvmCaller = async (profile, route, mode) => {
	assert.ok(nestedCheckedRecordJvmProfiles.includes(profile));
	assert.ok(nestedCheckedRecordJvmRoutes.includes(route));
	assert.ok(nestedCheckedRecordJvmModes.includes(mode));
	const extension = profile === "java" ? "java" : "kt";
	let source = await readFile(
		`tests/fixtures/nested-checked-record-consumers/${profile}.${extension}`
		, "utf8"
	);
	assert.equal((source.match(/ROUTE_PREFIX/gu) ?? []).length, 1);
	source = source.replace("ROUTE_PREFIX", route === "ordinary" ? "arg" : "value");
	const pattern = /^[ \t]*\/\/ BEGIN FULL_ONLY\n([\s\S]*?)^[ \t]*\/\/ END FULL_ONLY\n/gmu;
	assert.equal([...source.matchAll(pattern)].length, 2);
	source = source.replace(pattern, (_, content) => mode === "full" ? content : "");
	assert.doesNotMatch(source, /FULL_ONLY|ROUTE_PREFIX/u);
	return source;
};

/**
 * Require every independent check, rejection, recovery and snapshot total.
 *
 * @param stdout - Original caller standard output.
 * @param profile - Java or Kotlin public API.
 * @param mode - Full or result-only API.
 */
export const parseNestedCheckedRecordJvmResult = (stdout, profile, mode) => {
	assert.ok(nestedCheckedRecordJvmProfiles.includes(profile));
	assert.ok(nestedCheckedRecordJvmModes.includes(mode));
	const value = JSON.parse(stdout);
	assert.deepEqual(value, nestedCheckedRecordJvmCounts[profile][mode]);
	return value;
};

/** Exact independently authored reviewed IR for the selected API mode. */
export const nestedCheckedRecordJvmReview = nestedCheckedRecordReview;
