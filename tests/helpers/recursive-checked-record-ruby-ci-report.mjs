/**
 * Require one complete recursive checked-record Ruby selection and its original installed records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, posix } from "node:path";
import { recursiveCheckedRecordRubyRoutes, recursiveCheckedRecordRubyFixtures } from "./recursive-checked-record-ruby-fixture.mjs";
import { checkRecursiveCheckedRecordRubyReport } from "./recursive-checked-record-ruby-report.mjs";
import { assertRecursiveCheckedRecordRubyInterpreter } from "./recursive-checked-record-ruby-environment-records.mjs";

/**
 * Select exactly one installed producer, excluding source and archive checks.
 *
 * @param route - Ordinary source or independent review.
 * @param fixture - Recursive or mutual module.
 */
export const recursiveCheckedRecordRubyCiTestName = (route, fixture) => {
	assert.ok(recursiveCheckedRecordRubyRoutes.includes(route));
	assert.ok(recursiveCheckedRecordRubyFixtures.includes(fixture));
	return `installed recursive checked-record Ruby packages reproduce and relocate ${route} ${fixture}`;
};

/**
 * Reject unknown, repeated and incomplete options before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseRecursiveCheckedRecordRubyCiArgs = args => {
	const usage = "Usage: check-recursive-checked-record-ruby-ci.mjs --route ordinary|reviewed --fixture recursive|mutual --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --ruby /absolute/ruby";
	const allowed = ["route", "fixture", "producer", "directory", "tap", "glibc", "ruby"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !value.includes("\0"), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	recursiveCheckedRecordRubyCiTestName(selected.route, selected.fixture);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	assert.ok(isAbsolute(selected.ruby) && !/[\n\r]/u.test(selected.ruby), usage);
	assert.equal(posix.normalize(selected.ruby), selected.ruby, usage);
	return selected;
};

/**
 * Require a complete zero-skip TAP run, not merely a matching success line.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 * @param fixture - Required module.
 */
export const assertRecursiveCheckedRecordRubyCiTap = (source, route, fixture) => {
	const name = recursiveCheckedRecordRubyCiTestName(route, fixture);
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
 * Use the independent full checker with runtime facts supplied by the local host.
 *
 * @param options - Closed producer, route, fixture and floor options.
 * @param original - Original TAP, relative records and independently observed runtime.
 * @param original.tap - Combined stdout and stderr from the producer.
 * @param original.read - Reader relative to one retained route/fixture directory.
 * @param original.runtime - Actual checker host platform, architecture and glibc.
 * @param original.interpreter - Fresh identity and version query from the explicitly selected MRI.
 */
export const checkRecursiveCheckedRecordRubyCiRecords = async (options, { tap, read, runtime, interpreter }) => {
	const selected = parseRecursiveCheckedRecordRubyCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertRecursiveCheckedRecordRubyCiTap(tap, selected.route, selected.fixture);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(selected.glibc.split(".")[1]));
	const rubyVersion = JSON.parse(interpreter.run.stdout).version;
	assertRecursiveCheckedRecordRubyInterpreter(interpreter, rubyVersion);
	assert.equal(interpreter.command, selected.ruby);
	assert.deepEqual(JSON.parse(await read("interpreter.json")), interpreter);
	return checkRecursiveCheckedRecordRubyReport(read, { route: selected.route
		, fixture: selected.fixture, producerCommit: selected.producer
		, runtime, floor: selected.glibc, rubyVersion });
};
