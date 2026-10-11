/**
 * Require a complete four-ABI, two-mode Perl installed route and its original TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { checkedRecordPerlRoutes } from "./checked-record-perl-fixture.mjs";
import { assertCheckedRecordPerlRecords } from "./checked-record-perl-records.mjs";

/**
 * Refuse skipped, cancelled, duplicated or substituted installed tests.
 *
 * @param source - Original combined producer stdout and stderr.
 * @param route - Explicit full or result-only, ordinary or reviewed route.
 */
export const assertCheckedRecordPerlCiTap = (source, route) => {
	assert.ok(checkedRecordPerlRoutes.includes(route));
	const name = `installed checked-record Perl packages reproduce and relocate both delivery modes for ${route}`;
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
};

/**
 * Parse closed options before reading any producer paths.
 *
 * @param args - CLI arguments with explicit route, originals and required package floor.
 */
export const parseCheckedRecordPerlCiArgs = args => {
	const usage = "Usage: check-checked-record-perl-reports.mjs --route <route> --directory <records> --tap <original-tap> --glibc 2.36|2.38";
	const keys = ["route", "directory", "tap", "glibc"], parsed = {};
	assert.ok(Array.isArray(args) && args.length === keys.length * 2, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && keys.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(parsed, key) && typeof value === "string" && value.length && !value.startsWith("--"), usage);
		parsed[key] = value;
	}
	assert.ok(checkedRecordPerlRoutes.includes(parsed.route), usage);
	assert.ok(["2.36", "2.38"].includes(parsed.glibc), usage);
	return parsed;
};

/**
 * Check every original matrix entry and require the caller's explicit glibc floor.
 *
 * @param options - Original TAP, route, expected floor and archive-relative byte reader.
 */
export const assertCheckedRecordPerlCiRecords = async options => {
	assert.ok(["2.36", "2.38"].includes(options.glibc));
	assertCheckedRecordPerlCiTap(options.tap, options.route);
	const report = await assertCheckedRecordPerlRecords(options);
	assert.equal(report.glibcMinimumVersion, options.glibc);
	return report;
};
