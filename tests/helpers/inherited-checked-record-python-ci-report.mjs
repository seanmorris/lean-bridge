/**
 * Require one complete inherited checked-record Python selection and its original installed records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import {
	inheritedCheckedRecordPythonMinors
	, inheritedCheckedRecordPythonModes
	, inheritedCheckedRecordPythonRoutes
} from "./inherited-checked-record-python-fixture.mjs";
import {
	assertInheritedCheckedRecordPythonInterpreter
} from "./inherited-checked-record-python-environment-records.mjs";
import { checkInheritedCheckedRecordPythonReport } from "./inherited-checked-record-python-report.mjs";

/**
 * Select exactly one installed producer, excluding source and archive checks.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or constructor-free result-only package.
 */
export const inheritedCheckedRecordPythonCiTestName = (route, mode) => {
	assert.ok(inheritedCheckedRecordPythonRoutes.includes(route));
	assert.ok(inheritedCheckedRecordPythonModes.includes(mode));
	return `installed inherited checked-record Python packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject unknown, repeated and incomplete options before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseInheritedCheckedRecordPythonCiArgs = args => {
	const usage = "Usage: check-inherited-checked-record-python-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --python311 /absolute/python3.11 --python312 /absolute/python3.12";
	const allowed = [
			"route", "mode", "producer", "directory", "tap", "glibc"
			, "python311", "python312"
	], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--")
			&& !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	inheritedCheckedRecordPythonCiTestName(selected.route, selected.mode);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	for(const key of ["python311", "python312"])
		assert.ok(isAbsolute(selected[key]), usage);
	assert.notEqual(selected.python311, selected.python312, usage);
	return selected;
};

/**
 * Require a complete zero-skip TAP run, not merely a matching success line.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const assertInheritedCheckedRecordPythonCiTap = (source, route, mode) => {
	const name = inheritedCheckedRecordPythonCiTestName(route, mode);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source
		, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source
		, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Use the independent full checker with runtime facts supplied by the local host.
 *
 * @param options - Closed producer, route, mode and floor options.
 * @param original - Original TAP, relative records and independently observed runtime.
 * @param original.tap - Combined stdout and stderr from the producer.
 * @param original.read - Reader relative to one retained route/mode directory.
 * @param original.runtime - Actual checker host platform, architecture and glibc.
 * @param original.interpreters - Fresh CPython 3.11 and 3.12 observations.
 */
export const checkInheritedCheckedRecordPythonCiRecords = async (
	options, { tap, read, runtime, interpreters }
) => {
	const selected = parseInheritedCheckedRecordPythonCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertInheritedCheckedRecordPythonCiTap(tap, selected.route, selected.mode);
	const accepted = await checkInheritedCheckedRecordPythonReport(read, {
		route: selected.route
		, mode: selected.mode, producerCommit: selected.producer
		, runtime, floor: selected.glibc
	});
	assert.deepEqual(interpreters.map(item => item.minor)
		, inheritedCheckedRecordPythonMinors);
	for(const [index, item] of interpreters.entries())
	{
		const minor = inheritedCheckedRecordPythonMinors[index];
		assertInheritedCheckedRecordPythonInterpreter(item, minor);
		assert.equal(item.binary, selected[`python${minor.replace(".", "")}`]);
	}
	const report = JSON.parse(await read("report.json"));
	assert.deepEqual(report.interpreters, interpreters);
	return { ...accepted, interpreters };
};
