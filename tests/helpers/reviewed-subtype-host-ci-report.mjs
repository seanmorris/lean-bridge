/**
 * Require complete installed reviewed Subtype runs for an explicit native CI lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertReviewedSubtypeHostRecords } from "./reviewed-subtype-host-report.mjs";
import { assertReviewedSubtypeRubyJvmRecords } from "./reviewed-subtype-ruby-jvm-report.mjs";
import { assertReviewedSubtypeRemainingHostRecords } from "./reviewed-subtype-remaining-host-report.mjs";

export const reviewedSubtypeHostCiTestName = "installed reviewed native Subtype hosts reproduce and relocate the complete checked corpus";
export const reviewedSubtypeHostCiLanes = ["python", "rust", "dotnet", "java,kotlin", "ruby", "php-native", "wit-wasi", "perl"];
export const reviewedSubtypePerlConfigurations = ["5.36.3-threaded", "5.36.3-unthreaded", "5.38.2-threaded", "5.38.2-unthreaded"];

/**
 * Require exactly one real installed pass and one set of zero-failure TAP totals.
 *
 * @param source - Original combined producer stdout and stderr.
 */
export const assertReviewedSubtypeHostCiTap = source => {
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)].map(match => [Number(match[1]), match[2]]), [[1, reviewedSubtypeHostCiTestName]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [reviewedSubtypeHostCiTestName]);
	for(const [name, expected] of Object.entries({ tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${name} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, name); assert.equal(Number(matches[0][1]), expected, name);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	return true;
};

/**
 * Parse closed, nonduplicated options before opening any producer record.
 *
 * @param args - Arguments after the script name.
 */
export const parseReviewedSubtypeHostCiArgs = args => {
	const usage = "Usage: check-reviewed-subtype-host-reports.mjs --profiles <lane> --directory <records> --tap <original-tap> --glibc 2.36|2.38 [--python 3.11|3.12] [--perl <version>-threaded|unthreaded]";
	const allowed = ["profiles", "directory", "tap", "glibc", "python", "perl"], parsed = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(parsed, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--"), usage);
		parsed[key] = value;
	}
	for(const key of ["profiles", "directory", "tap", "glibc"]) assert.ok(Object.hasOwn(parsed, key), usage);
	assert.ok(reviewedSubtypeHostCiLanes.includes(parsed.profiles), usage);
	assert.ok(["2.36", "2.38"].includes(parsed.glibc), usage);
	assert.equal(Object.hasOwn(parsed, "python"), parsed.profiles === "python", usage);
	assert.equal(Object.hasOwn(parsed, "perl"), parsed.profiles === "perl", usage);
	if(parsed.python) assert.ok(["3.11", "3.12"].includes(parsed.python), usage);
	if(parsed.perl) assert.ok(reviewedSubtypePerlConfigurations.includes(parsed.perl), usage);
	return { ...parsed, profiles: parsed.profiles.split(",") };
};

/**
 * Check full producer records and the selected interpreter, without reading old absolute paths.
 *
 * @param options - Parsed lane, original TAP and relative record reader.
 */
export const assertReviewedSubtypeHostCiRecords = async options => {
	// Revalidate callers that bypass the CLI parser.
	const selected = parseReviewedSubtypeHostCiArgs([
		"--profiles", options.profiles.join(",")
		, "--directory", "records", "--tap", "run.tap", "--glibc", options.glibc
		, ...options.python === undefined ? [] : ["--python", options.python]
		, ...options.perl === undefined ? [] : ["--perl", options.perl]
	]);
	assertReviewedSubtypeHostCiTap(options.tap);
	const check = selected.profiles.includes("python") ? assertReviewedSubtypeHostRecords
		: selected.profiles.some(profile => ["ruby", "java", "kotlin"].includes(profile)) ? assertReviewedSubtypeRubyJvmRecords
			: assertReviewedSubtypeRemainingHostRecords;
	const report = await check({ ...selected, read: options.read });
	if(selected.perl)
	{
		const [version, abi] = selected.perl.split("-"), actual = report.reports[0].perl;
		assert.equal(actual.version, version);
		assert.equal(actual.useithreads, abi === "threaded" ? "define" : null);
		assert.equal(actual.usemultiplicity, actual.useithreads);
	}
	return report;
};
