/**
 * Require a complete nominal Rust selection and its original installed records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, normalize } from "node:path";
import { nominalPrimitiveSubtypeRustRoutes, nominalPrimitiveSubtypeRustModes } from "./nominal-primitive-subtype-rust-fixture.mjs";
import { checkNominalPrimitiveSubtypeRustReport } from "./nominal-primitive-subtype-rust-report.mjs";
import { nominalPrimitiveSubtypeRustDependencyManifests } from "./nominal-primitive-subtype-rust-dependency-records.mjs";

/**
 * Select exactly one installed producer, excluding source and archive checks.
 *
 * @param route - Ordinary source or independent review.
 * @param mode - Full or constructor-free result-only package.
 */
export const nominalPrimitiveSubtypeRustCiTestName = (route, mode) => {
	assert.ok(nominalPrimitiveSubtypeRustRoutes.includes(route));
	assert.ok(nominalPrimitiveSubtypeRustModes.includes(mode));
	return `installed primitive-base nominal Rust packages reproduce and relocate ${route} ${mode}`;
};

/**
 * Reject unknown, repeated and incomplete options before opening any records.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseNominalPrimitiveSubtypeRustCiArgs = args => {
	const usage = "Usage: check-nominal-primitive-subtype-rust-ci.mjs --route ordinary|reviewed --mode full|result-only --producer <commit> --directory <records> --tap <original-tap> --glibc 2.36|2.38 --rustc /absolute/rustc --cargo /absolute/cargo";
	const allowed = ["route", "mode", "producer", "directory", "tap", "glibc", "rustc", "cargo"], selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--") && allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string" && value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	nominalPrimitiveSubtypeRustCiTestName(selected.route, selected.mode);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u);
	assert.ok(["2.36", "2.38"].includes(selected.glibc), usage);
	for(const name of ["rustc", "cargo"])
		assert.ok(isAbsolute(selected[name]) && normalize(selected[name]) === selected[name], usage);
	assert.notEqual(selected.rustc, selected.cargo, usage);
	return selected;
};

/**
 * Require a complete zero-skip TAP run, not merely a matching success line.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 * @param mode - Required package API.
 */
export const assertNominalPrimitiveSubtypeRustCiTap = (source, route, mode) => {
	const name = nominalPrimitiveSubtypeRustCiTestName(route, mode);
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
 * Derive checksum supplements from the original handoff, without editing records.
 *
 * @param read - Reader relative to one producer's retained records directory.
 */
export const nominalPrimitiveSubtypeRustCiReader = async read => {
	const dependencies = JSON.parse(await read("dependencies.json"));
	const manifests = nominalPrimitiveSubtypeRustDependencyManifests(await read("dependency-handoff/rust-dependencies.tar.gz"), dependencies);
	for(const [path, bytes] of manifests) assert.deepEqual(await read(path), bytes, path);
	return read;
};

/**
 * Use the full independent checker with fresh host and selected-tool identities.
 *
 * @param options - Closed producer, route, mode, floor and tool selections.
 * @param original - Original records and independently observed runtime facts.
 * @param original.tap - Combined stdout and stderr from the producer.
 * @param original.read - Relative record reader with archive-derived supplements.
 * @param original.runtime - Actual checker host platform, architecture and glibc.
 * @param original.toolchain - Fresh binary identities and version queries.
 */
export const checkNominalPrimitiveSubtypeRustCiRecords = async (options, { tap, read, runtime, toolchain }) => {
	const selected = parseNominalPrimitiveSubtypeRustCiArgs(Object.entries(options).flatMap(([key, value]) => ["--" + key, value]));
	assertNominalPrimitiveSubtypeRustCiTap(tap, selected.route, selected.mode);
	const versions = { rustc: "rustc 1.90.0 (1159e78c4 2025-09-14)\n"
		, cargo: "cargo 1.90.0 (840b83a10 2025-07-30)\n" };
	for(const name of ["rustc", "cargo"])
	{
		assert.equal(toolchain[name].command, selected[name]);
		assert.deepEqual(toolchain[name].run, { code: 0, stdout: versions[name], stderr: "" });
	}
	return checkNominalPrimitiveSubtypeRustReport(read, { route: selected.route
		, mode: selected.mode, producerCommit: selected.producer
		, runtime, floor: selected.glibc, toolchain });
};
