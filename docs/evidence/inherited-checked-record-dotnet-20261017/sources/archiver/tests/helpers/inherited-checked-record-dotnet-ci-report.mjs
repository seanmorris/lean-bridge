/**
 * Require one complete inherited checked-record C# selection with independently observed host pins.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import { inheritedCheckedRecordDotnetRoutes, inheritedCheckedRecordDotnetModes } from "./inherited-checked-record-dotnet-fixture.mjs";
import { checkInheritedCheckedRecordDotnetReport } from "./inherited-checked-record-dotnet-report.mjs";

/**
 * Select a single installed producer, excluding compiler and archive unit tests.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or constructor-free result-only package.
 */
export const inheritedCheckedRecordDotnetCiTestName = (route, mode) => {
	assert.ok(inheritedCheckedRecordDotnetRoutes.includes(route));
	assert.ok(inheritedCheckedRecordDotnetModes.includes(mode));
	return `installed inherited checked-record C# packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject unknown, repeated and incomplete options before opening records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseInheritedCheckedRecordDotnetCiArgs = args => {
	const usage = "Usage: check-inherited-checked-record-dotnet-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --dotnet /absolute/dotnet";
	const allowed = ["route", "mode", "producer", "directory", "tap", "glibc", "dotnet"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	inheritedCheckedRecordDotnetCiTestName(selected.route, selected.mode);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	assert.ok(isAbsolute(selected.dotnet), usage);
	return selected;
};

/**
 * Require zero-skip TAP with exactly one matching result and complete totals.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const assertInheritedCheckedRecordDotnetCiTap = (source, route, mode) => {
	const name = inheritedCheckedRecordDotnetCiTestName(route, mode).replace("#", "\\#");
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	for(const [key, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Apply the complete record checker to fresh, independently measured host facts.
 *
 * @param options - Closed producer, route, mode, floor and tool selection.
 * @param original - Original records and fresh tool/framework identities.
 * @param original.tap - Complete original producer output.
 * @param original.read - Selection-relative retained-record reader.
 * @param original.runtime - Actual checker platform, architecture and glibc.
 * @param original.toolchain - Fresh host and SDK measurements.
 * @param original.framework - Fresh compiled-caller runtime observation.
 * @param original.archiveSha512 - Digest derived from the verified original archive.
 */
export const checkInheritedCheckedRecordDotnetCiRecords = async (options, { tap, read, runtime, toolchain, framework, archiveSha512 }) => {
	const selected = parseInheritedCheckedRecordDotnetCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertInheritedCheckedRecordDotnetCiTap(tap, selected.route, selected.mode);
	assert.equal(toolchain.command, selected.dotnet);
	assert.equal(toolchain.sdk.version, "8.0.424");
	return checkInheritedCheckedRecordDotnetReport(read, { route: selected.route
		, mode: selected.mode, producerCommit: selected.producer
		, runtime, floor: selected.glibc, toolchain, framework, archiveSha512 });
};
