/**
 * Exact C/C++ author selections and independent caller sources for value indices.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
	checkedRecordValueIndexBrowserRoutes
	, checkedRecordValueIndexBrowserSelection
} from "./checked-record-value-index-browser-fixture.mjs";

export const checkedRecordValueIndexNativeProfiles = Object.freeze(["c", "cpp"]);
export const checkedRecordValueIndexNativeRoutes
	= checkedRecordValueIndexBrowserRoutes;
export const checkedRecordValueIndexNativeCoordinate = Object.freeze({
	name: "checkedrecordvalueindices", version: "1.0.0"
});

/**
 * Replace only npm coordinates with the two independently consumed native packages.
 *
 * @param route - Exact full/result-only and ordinary/reviewed route.
 */
export const checkedRecordValueIndexNativeSelection = route => {
	const selected = checkedRecordValueIndexBrowserSelection(route);
	return {
		...selected
		, configuration: {
			...selected.configuration
			, targets: {
				c: checkedRecordValueIndexNativeCoordinate
				, cpp: checkedRecordValueIndexNativeCoordinate
			}
		}
	};
};

const extension = Object.freeze({ c: "c", cpp: "cpp" });

/**
 * Load one immutable public caller and relabel only reviewed parameter diagnostics.
 *
 * @param profile - C or C++.
 * @param route - Exact full/result-only and ordinary/reviewed route.
 * @param reader - Optional historical Git-backed source reader.
 */
export const checkedRecordValueIndexNativeCaller = async (
	profile, route, reader = path => readFile(path)
) => {
	assert.ok(checkedRecordValueIndexNativeProfiles.includes(profile));
	const selection = checkedRecordValueIndexNativeSelection(route);
	const name = `${selection.resultOnly ? "result-only-" : ""}${profile}.${extension[profile]}`;
	let source = (await reader(
		`tests/fixtures/checked-record-value-index-native/${name}`)).toString();
	if(selection.reviewed)
		source = source.replaceAll('"arg0 was rejected by ', '"value0 was rejected by ');
	const checks = (source.match(/\bCHECK\(/gu) ?? []).length - 1;
	assert.ok(checks > 0, "Native caller must execute explicit assertions");
	return {
		source, checks, calls: selection.resultOnly ? 8 : 28
		, rejections: selection.resultOnly ? 0 : 6
		, recoveries: selection.resultOnly ? 0 : 6
	};
};

/**
 * Parse the one-line consumer receipt emitted by either native caller.
 *
 * @param source - One canonical JSON line from the native process.
 * @param expected - Expected counters derived from the immutable caller.
 * @param label - Assertion label for retained execution evidence.
 */
export const parseCheckedRecordValueIndexNativeResult = (
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
