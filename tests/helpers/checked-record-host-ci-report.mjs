/**
 * Require complete installed checked-record runs for an explicit native lane and route.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertCheckedRecordHostRecords } from "./checked-record-native-records.mjs";
import { assertCheckedRecordRubyJvmRecords } from "./checked-record-ruby-jvm-report.mjs";
import { assertCheckedRecordRemainingHostRecords } from "./checked-record-remaining-host-report.mjs";
import { checkedRecordHostRoutes } from "./checked-record-native-fixture.mjs";

export const checkedRecordCiSelections = [
	"python", "rust", "dotnet", "java,kotlin", "ruby", "php-native", "wit-wasi"
	, "java,kotlin,ruby", "dotnet,php-native,rust,wit-wasi"
];

/**
 * Require exactly one real installed pass for the requested route, without skipped tests.
 *
 * @param source - Original combined producer stdout and stderr.
 * @param route - Ordinary/reviewed, full/result-only route.
 */
export const assertCheckedRecordHostCiTap = (source, route) => {
	assert.ok(checkedRecordHostRoutes.includes(route));
	const name = `installed checked-record native hosts reproduce and relocate ${route}`;
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
	return true;
};

/**
 * Parse closed options before opening any producer record.
 *
 * @param args - CLI argument list.
 */
export const parseCheckedRecordHostCiArgs = args => {
	const usage = "Usage: check-checked-record-host-reports.mjs --profiles <selection> --route <route> --directory <records> --tap <original-tap> --glibc 2.36|2.38 [--python 3.11|3.12]";
	const allowed = ["profiles", "route", "directory", "tap", "glibc", "python"], parsed = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(parsed, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--"), usage);
		parsed[key] = value;
	}
	for(const key of ["profiles", "route", "directory", "tap", "glibc"]) assert.ok(Object.hasOwn(parsed, key), usage);
	assert.ok(checkedRecordCiSelections.includes(parsed.profiles), usage);
	assert.ok(checkedRecordHostRoutes.includes(parsed.route), usage);
	assert.ok(["2.36", "2.38"].includes(parsed.glibc), usage);
	assert.equal(Object.hasOwn(parsed, "python"), parsed.profiles === "python", usage);
	if(parsed.python) assert.ok(["3.11", "3.12"].includes(parsed.python), usage);
	return { ...parsed, profiles: parsed.profiles.split(",") };
};

/**
 * Check original route records and the requested interpreter without opening old producer paths.
 *
 * @param options - Parsed selection, route, original TAP and relative record reader.
 */
export const assertCheckedRecordHostCiRecords = async options => {
	const selected = parseCheckedRecordHostCiArgs([
		"--profiles", options.profiles.join(","), "--route", options.route
		, "--directory", "records", "--tap", "run.tap", "--glibc", options.glibc
		, ...options.python === undefined ? [] : ["--python", options.python]
	]);
	assertCheckedRecordHostCiTap(options.tap, selected.route);
	const check = selected.profiles.includes("python") ? assertCheckedRecordHostRecords
		: selected.profiles.some(profile => ["ruby", "java", "kotlin"].includes(profile)) ? assertCheckedRecordRubyJvmRecords
			: assertCheckedRecordRemainingHostRecords;
	return check({ ...selected, read: options.read });
};
