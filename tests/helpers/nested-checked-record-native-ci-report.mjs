/**
 * Require one complete nested checked-record C/C++ selection and its original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	checkNestedCheckedRecordNativeControls
} from "./nested-checked-record-native-controls.mjs";
import {
	nestedCheckedRecordNativeModes, nestedCheckedRecordNativeRoutes
} from "./nested-checked-record-native-fixture.mjs";

/**
 * Name one exact installed producer subtest.
 *
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const nestedCheckedRecordNativeCiTestName = (route, mode) => {
	assert.ok(nestedCheckedRecordNativeRoutes.includes(route));
	assert.ok(nestedCheckedRecordNativeModes.includes(mode));
	return `installed nested checked-record native packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject unknown, repeated and incomplete checker arguments before reading records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseNestedCheckedRecordNativeCiArgs = args => {
	const usage = "Usage: check-nested-checked-record-native-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --max-load 6|8|10|12";
	const allowed = ["route", "mode", "producer", "directory", "tap"
			, "glibc", "max-load"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	nestedCheckedRecordNativeCiTestName(selected.route, selected.mode);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	assert.ok(["6", "8", "10", "12"].includes(selected["max-load"]), usage);
	return selected;
};

/**
 * Require a complete zero-skip TAP run for the selected installed test.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const assertNestedCheckedRecordNativeCiTap = (source, route, mode) => {
	const name = nestedCheckedRecordNativeCiTestName(route, mode);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)]
		.map(match => match[0]), ["1..1"]);
};

/**
 * Recheck every original record and destructive control with runtime facts from the host.
 *
 * @param options - Closed producer, route, mode, floor and load options.
 * @param original - Original TAP, relative records and observed runtime.
 * @param original.tap - Combined stdout and stderr from the producer.
 * @param original.read - Reader relative to one retained selection directory.
 * @param original.runtime - Actual checker host platform, architecture and glibc.
 */
export const checkNestedCheckedRecordNativeCiRecords = async (
	options, { tap, read, runtime }
) => {
	const selected = parseNestedCheckedRecordNativeCiArgs(
		Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNestedCheckedRecordNativeCiTap(tap, selected.route, selected.mode);
	return checkNestedCheckedRecordNativeControls(read, {
		route: selected.route, mode: selected.mode
		, producerCommit: selected.producer, runtime, floor: selected.glibc
		, maxLoad: Number(selected["max-load"])
	});
};
