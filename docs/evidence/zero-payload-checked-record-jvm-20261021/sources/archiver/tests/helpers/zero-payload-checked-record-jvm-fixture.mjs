/**
 * Exact Maven selections and independent Java/Kotlin callers for proof-erased
 * zero-payload checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadJvmRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadJvmProfiles = Object.freeze(["java", "kotlin"]);
export const zeroPayloadJvmTarget = Object.freeze({
	name: "org.leanbridge:zeropayloadcheckedrecords", version: "1.0.0"
});
export const zeroPayloadJvmCounts = Object.freeze({
	full: Object.freeze({
		calls: 21, checks: 22, recoveries: 4, rejections: 4
	})
	, "result-only": Object.freeze({
		calls: 8, checks: 9, recoveries: 0, rejections: 0
	})
});

/**
 * Replace only npm coordinates with one independently consumed Maven package.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadJvmSelection = route => {
	const selected = zeroPayloadBrowserSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: { maven: zeroPayloadJvmTarget }
		}
	};
};

/**
 * Reject disabled explicit selections, spelling mistakes and duplicate routes.
 *
 * @param environment - Explicit injectable producer environment.
 */
export const zeroPayloadJvmEnvironment = environment => {
	const prefix = "LEAN_BRIDGE_ZERO_PAYLOAD_JVM_";
	const flag = environment[prefix + "TEST"];
	assert.ok(flag === undefined || ["0", "1"].includes(flag)
		, "Invalid zero-payload JVM TEST");
	const raw = environment[prefix + "ROUTES"];
	if(raw !== undefined)
	{
		assert.equal(flag, "1", "Explicit zero-payload JVM routes require TEST=1");
		assert.equal(typeof raw, "string");
	}
	for(const name of [prefix + "OUTPUT", prefix + "MAX_LOAD"])
		if(environment[name] !== undefined)
			assert.equal(flag, "1", `Explicit ${name} requires TEST=1`);
	const routes = raw === undefined ? [...zeroPayloadJvmRoutes] : raw.split(",");
	assert.ok(routes.length
		&& routes.every(route => zeroPayloadJvmRoutes.includes(route))
		&& new Set(routes).size === routes.length
	, "Invalid zero-payload JVM routes");
	const rawLoad = environment[prefix + "MAX_LOAD"];
	const maxLoad = rawLoad === undefined
		? environment.CI === "true" ? 6 : 10 : Number(rawLoad);
	assert.ok([6, 8, 10, 12].includes(maxLoad)
		, "Zero-payload JVM max load must be 6, 8, 10, or 12");
	return { enabled: flag === "1", routes, maxLoad };
};

/**
 * Select only route diagnostics and full/result-only blocks from one immutable
 * public caller.
 *
 * @param profile - Java or Kotlin public API.
 * @param route - Exact author/API route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const zeroPayloadJvmCaller = async (
	profile, route, reader = path => readFile(path)
) => {
	assert.ok(zeroPayloadJvmProfiles.includes(profile));
	const selection = zeroPayloadJvmSelection(route);
	const extension = profile === "java" ? "java" : "kt";
	let source = (await reader(
		`tests/fixtures/zero-payload-checked-record-jvm/${profile}.${extension}`
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
export const parseZeroPayloadJvmResult = (source, route) => {
	assert.equal(typeof source, "string");
	const selection = zeroPayloadJvmSelection(route);
	const expected = zeroPayloadJvmCounts[
		selection.resultOnly ? "result-only" : "full"
	];
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort()
		, ["calls", "checks", "recoveries", "rejections"]);
	assert.deepEqual(value, expected);
	return value;
};
