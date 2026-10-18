/**
 * Fail-closed CLI/TAP contract for hosted recursive checked-record C/C++ runs.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	checkMutualCheckedRecordNativeReport, mutualCheckedRecordNativeRoutes
} from "./mutual-checked-record-native-report.mjs";

/**
 * Name the only permitted hosted test for one source route.
 *
 * @param route - Ordinary or reviewed source route.
 */
export const mutualCheckedRecordNativeCiTestName = route => {
	assert.ok(mutualCheckedRecordNativeRoutes.includes(route));
	return `installed mutual checked-record C/C++ packages reproduce and relocate ${route}`;
};

/**
 * Parse the closed hosted checker argument set.
 *
 * @param args - Checker CLI arguments.
 */
export const parseMutualCheckedRecordNativeCiArgs = args => {
	const usage = "Usage: check-mutual-checked-record-native-ci.mjs --route ordinary|reviewed --producer <commit> --directory <records> --tap <original-tap>";
	const allowed = ["route", "producer", "directory", "tap"], selected = {};
	assert.ok(Array.isArray(args) && args.length === allowed.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	mutualCheckedRecordNativeCiTestName(selected.route);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	return selected;
};

/**
 * Require one complete, unskipped installed-package TAP result.
 *
 * @param source - Original Node TAP output.
 * @param route - Required source route.
 */
export const assertMutualCheckedRecordNativeCiTap = (source, route) => {
	const name = mutualCheckedRecordNativeCiTestName(route);
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)]
		.map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({
		tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0
		, skipped: 0, todo: 0
	})) {
		const matches = [...source.matchAll(new RegExp(
			`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key);
		assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)]
		.map(match => match[0]), ["1..1"]);
};

/**
 * Recheck original TAP and every retained route record.
 *
 * @param options - Closed checker CLI values.
 * @param original - Original TAP and record reader.
 * @param original.tap - Original Node TAP output.
 * @param original.read - Reader relative to the route record directory.
 */
export const checkMutualCheckedRecordNativeCiRecords = async (
	options, original
) => {
	const { tap, read } = original;
	const selected = parseMutualCheckedRecordNativeCiArgs(
		Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertMutualCheckedRecordNativeCiTap(tap, selected.route);
	return checkMutualCheckedRecordNativeReport(read, {
		route: selected.route, producerCommit: selected.producer
	});
};
