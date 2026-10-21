/**
 * Require one complete hosted Rust selection and independently checked records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isAbsolute, normalize } from "node:path";
import {
	zeroPayloadRustDependencyManifests
} from "./zero-payload-checked-record-rust-dependency-records.mjs";
import { zeroPayloadRustRoutes } from "./zero-payload-checked-record-rust-fixture.mjs";
import { checkZeroPayloadRustReport } from "./zero-payload-checked-record-rust-report.mjs";

/**
 * Name one exact hosted producer test.
 *
 * @param route - Closed author route and API mode.
 */
export const zeroPayloadRustCiTestName = route => {
	assert.ok(zeroPayloadRustRoutes.includes(route));
	return `installed zero-payload checked-record Rust packages reproduce and relocate ${route}`;
};

/**
 * Reject unknown, repeated, and incomplete checker options.
 *
 * @param args - Arguments following the checker script name.
 */
export const parseZeroPayloadRustCiArgs = args => {
	const usage = "Usage: check-zero-payload-checked-record-rust-ci.mjs --route ordinary-source|reviewed-ir|result-only-ordinary-source|result-only-reviewed-ir --producer <commit> --directory <records> --tap <original-tap> --glibc 2.38 --rustc /absolute/rustc --cargo /absolute/cargo";
	const allowed = ["route", "producer", "directory", "tap", "glibc", "rustc", "cargo"];
	const selected = {};
	assert.ok(Array.isArray(args) && args.length % 2 === 0, usage);
	for(let index = 0; index < args.length; index += 2)
	{
		const flag = args[index], value = args[index + 1];
		assert.ok(typeof flag === "string" && flag.startsWith("--")
			&& allowed.includes(flag.slice(2)), usage);
		const key = flag.slice(2);
		assert.ok(!Object.hasOwn(selected, key) && typeof value === "string"
			&& value.length > 0 && !value.startsWith("--") && !/[\0\r\n]/u.test(value), usage);
		selected[key] = value;
	}
	assert.deepEqual(Object.keys(selected).sort(), [...allowed].sort(), usage);
	zeroPayloadRustCiTestName(selected.route);
	assert.match(selected.producer, /^[a-f0-9]{40}$/u); assert.equal(selected.glibc, "2.38");
	for(const name of ["rustc", "cargo"])
		assert.ok(isAbsolute(selected[name]) && normalize(selected[name]) === selected[name], usage);
	assert.notEqual(selected.rustc, selected.cargo, usage);
	return selected;
};

/**
 * Require a complete zero-skip TAP run for one selected route.
 *
 * @param source - Original combined producer output.
 * @param route - Required author route.
 */
export const assertZeroPayloadRustCiTap = (source, route) => {
	const name = zeroPayloadRustCiTestName(route);
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.deepEqual([...source.matchAll(/^ok (\d+) - (.+)$/gmu)]
		.map(match => [Number(match[1]), match[2]]), [[1, name]]);
	assert.deepEqual([...source.matchAll(/^# Subtest: (.+)$/gmu)].map(match => match[1]), [name]);
	const totals = { tests: 1, suites: 0, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 };
	for(const [key, expected] of Object.entries(totals))
	{
		const matches = [...source.matchAll(new RegExp(`^# ${key} (\\d+)$`, "gmu"))];
		assert.equal(matches.length, 1, key); assert.equal(Number(matches[0][1]), expected, key);
	}
	assert.deepEqual([...source.matchAll(/^\d+\.\.\d+.*$/gmu)].map(match => match[0]), ["1..1"]);
	assert.match(source, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
};

/**
 * Derive checksum manifests from the original dependency handoff.
 *
 * @param read - Reader relative to one retained producer directory.
 */
export const zeroPayloadRustCiReader = async read => {
	const dependencies = JSON.parse(await read("dependencies.json"));
	const archive = await read("dependency-handoff/rust-dependencies.tar.gz");
	const manifests = zeroPayloadRustDependencyManifests(archive, dependencies);
	for(const [path, bytes] of manifests) assert.deepEqual(await read(path), bytes, path);
	return read;
};

/**
 * Check one original hosted run with fresh runtime and tool identities.
 *
 * @param options - Closed route, producer, floor, and tool selections.
 * @param original - Original retained records and fresh host observations.
 * @param original.tap - Combined producer TAP.
 * @param original.read - Original record reader.
 * @param original.runtime - Actual checker host identity.
 * @param original.toolchain - Fresh compiler identities.
 */
export const checkZeroPayloadRustCiRecords = async (options, original) => {
	const { tap, read, runtime, toolchain } = original;
	const selected = parseZeroPayloadRustCiArgs(
		Object.entries(options).flatMap(([key, value]) => ["--" + key, value])
	);
	assertZeroPayloadRustCiTap(tap, selected.route);
	for(const name of ["rustc", "cargo"])
	{
		assert.equal(toolchain[name].command, selected[name]);
		assert.equal(toolchain[name].run.code, 0); assert.equal(toolchain[name].run.stderr, "");
		assert.match(toolchain[name].run.stdout, new RegExp(`^${name} 1\\.90\\.0 `, "u"));
	}
	return checkZeroPayloadRustReport(read, {
		route: selected.route, producerCommit: selected.producer
		, runtime, floor: selected.glibc, toolchain
	});
};
