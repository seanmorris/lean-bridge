/**
 * Require one complete nominal Ruby selection and its original installed records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, posix } from "node:path";
import { nominalPrimitiveSubtypeRubyRoutes, nominalPrimitiveSubtypeRubyModes } from "./nominal-primitive-subtype-ruby-fixture.mjs";
import { checkNominalPrimitiveSubtypeRubyReport } from "./nominal-primitive-subtype-ruby-report.mjs";
import { assertNominalPrimitiveSubtypeRubyInterpreter } from "./nominal-primitive-subtype-ruby-environment-records.mjs";

/**
 * Select exactly one installed producer, excluding source and archive checks.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeRubyCiTestName = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeRubyRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypeRubyModes.includes(mode));
	return `installed primitive-base nominal Ruby packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject unknown, repeated and incomplete options before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseNominalPrimitiveSubtypeRubyCiArgs = args => {
	const usage = "Usage: check-nominal-primitive-subtype-ruby-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --ruby /absolute/ruby";
	const allowed = ["route", "mode", "producer", "directory", "tap", "glibc", "ruby"], selected = {};
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
	nominalPrimitiveSubtypeRubyCiTestName(selected.route, selected.mode);
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
 * @param mode - Required package API.
 */
export const assertNominalPrimitiveSubtypeRubyCiTap = (source, route, mode) => {
	const name = nominalPrimitiveSubtypeRubyCiTestName(route, mode);
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
 * @param options - Closed producer, route, mode and floor options.
 * @param original - Original TAP, relative records and independently observed runtime.
 * @param original.tap - Combined stdout and stderr from the producer.
 * @param original.read - Reader relative to one retained route/mode directory.
 * @param original.runtime - Actual checker host platform, architecture and glibc.
 * @param original.interpreter - Fresh identity and version query from the explicitly selected MRI.
 */
export const checkNominalPrimitiveSubtypeRubyCiRecords = async (options, { tap, read, runtime, interpreter }) => {
	const selected = parseNominalPrimitiveSubtypeRubyCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalPrimitiveSubtypeRubyCiTap(tap, selected.route, selected.mode);
	assert.deepEqual(Object.keys(runtime).sort(), ["arch", "glibc", "platform"]);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64");
	assert.match(runtime.glibc, /^2\.[0-9]+$/u);
	assert.ok(Number(runtime.glibc.split(".")[1]) >= Number(selected.glibc.split(".")[1]));
	const rubyVersion = JSON.parse(interpreter.run.stdout).version;
	assertNominalPrimitiveSubtypeRubyInterpreter(interpreter, rubyVersion);
	assert.equal(interpreter.command, selected.ruby);
	assert.deepEqual(JSON.parse(await read("interpreter.json")), interpreter);
	return checkNominalPrimitiveSubtypeRubyReport(read, { route: selected.route
		, mode: selected.mode, producerCommit: selected.producer
		, runtime, floor: selected.glibc, rubyVersion });
};
