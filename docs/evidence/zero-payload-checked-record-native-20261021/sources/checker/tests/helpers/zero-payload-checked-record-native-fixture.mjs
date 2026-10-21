/**
 * Exact C/C++ author selections and independent zero-payload caller sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	zeroPayloadBrowserRoutes, zeroPayloadBrowserSelection
} from "./zero-payload-checked-record-browser-fixture.mjs";

export const zeroPayloadNativeProfiles = Object.freeze(["c", "cpp"]);
export const zeroPayloadNativeRoutes = zeroPayloadBrowserRoutes;
export const zeroPayloadNativeCoordinate = Object.freeze({
	name: "zeropayloadcheckedrecords", version: "1.0.0"
});

/**
 * Replace only npm coordinates with independently consumed C and C++ packages.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const zeroPayloadNativeSelection = route => {
	const selected = zeroPayloadBrowserSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: {
				c: zeroPayloadNativeCoordinate, cpp: zeroPayloadNativeCoordinate
			}
		}
	};
};

const extension = Object.freeze({ c: "c", cpp: "cpp" });

/**
 * Load one immutable public caller and relabel only reviewed diagnostics.
 *
 * @param profile - C or C++.
 * @param route - Exact full/result-only and ordinary/reviewed route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const zeroPayloadNativeCaller = async (
	profile, route, reader = path => readFile(path)
) => {
	assert.ok(zeroPayloadNativeProfiles.includes(profile));
	const selection = zeroPayloadNativeSelection(route);
	const name = `${selection.resultOnly ? "result-only-" : ""}${profile}.${extension[profile]}`;
	let source = (await reader(
		`tests/fixtures/zero-payload-checked-record-native/${name}`)).toString();
	if(selection.reviewed)
		source = source.replaceAll('"arg0 was rejected by '
			, '"value0 was rejected by ');
	const checks = (source.match(/\bCHECK\(/gu) ?? []).length - 1;
	assert.ok(checks > 0, "Native caller must execute explicit assertions");
	return {
		source, checks, calls: selection.resultOnly ? 8 : 15
		, rejections: selection.resultOnly ? 0 : 1
		, recoveries: selection.resultOnly ? 0 : 1
	};
};

/**
 * Parse the one-line consumer receipt emitted by either native caller.
 *
 * @param source - One canonical JSON line from the native process.
 * @param expected - Expected counters derived from the immutable caller.
 * @param label - Assertion label for retained execution evidence.
 */
export const parseZeroPayloadNativeResult = (
	source, expected, label = "native result"
) => {
	assert.equal(typeof source, "string");
	const value = JSON.parse(source);
	assert.deepEqual(Object.keys(value).sort()
		, ["calls", "checks", "recoveries", "rejections"]);
	assert.deepEqual(value, {
		checks: expected.checks, calls: expected.calls
		, rejections: expected.rejections, recoveries: expected.recoveries
	}, label);
	return value;
};
