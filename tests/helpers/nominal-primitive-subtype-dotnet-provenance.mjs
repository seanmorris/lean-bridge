/**
 * Authenticate local primitive-base nominal C# producer invocations and terminal TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const nominalPrimitiveSubtypeDotnetSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/**
 * Require a completed, serial, low-load run from the independently selected producer.
 *
 * @param options - Original launch, completion, output and runner records.
 * @param options.start - Original start record.
 * @param options.end - Original terminal record.
 * @param options.tap - Complete original combined TAP output.
 * @param options.runner - Original monitored runner source bytes.
 * @param options.route - Selected ordinary or reviewed author route.
 * @param options.mode - Selected full or result-only API.
 * @param options.prefix - Exact task-specific output prefix.
 * @param options.producerCommit - Frozen Git commit.
 * @param options.floor - Explicit package glibc floor.
 * @param options.loadCeiling - Explicit local producer admission ceiling.
 */
export const assertNominalPrimitiveSubtypeDotnetRun = ({ start, end, tap, runner, route, mode, prefix, producerCommit, floor, loadCeiling }) => {
	assert.ok(nominalPrimitiveSubtypeDotnetSelections.some(selection => selection[0] === route && selection[1] === mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.equal(loadCeiling, 8);
	assert.match(prefix, new RegExp(`^build/vo1494-nominal-primitive-dotnet-${route}-${mode}-r[0-9]+-${producerCommit.slice(0, 7)}$`, "u"));
	assert.equal(start.revision, producerCommit); assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.equal(start.runnerSha256, sha256(runner)); assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, ["-n", "10", "/usr/bin/ionice", "-c", "3"
		, "/usr/bin/taskset", "-c", "7", "/usr/bin/node", "--test"
		, "--test-concurrency=1"
		, "tests/helpers/nominal-primitive-subtype-dotnet-installed-tests.mjs"]);
	assert.deepEqual(start.environment, {
		LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_TEST: "1"
		, LEAN_BRIDGE_DOTNET: "/app/.toolchains/dotnet/dotnet"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_ROUTES: route
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MODES: mode
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_OUTPUT: prefix + "-records"
		, LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_MAX_LOAD: String(loadCeiling)
		, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: floor
		, LEAN_NUM_THREADS: "1", MSBUILDDISABLENODEREUSE: "1"
		, OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	});
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048 && start.initial.load < loadCeiling);
	assert.ok(end.minimum.freeMiB >= 2048 && end.minimum.availableMiB >= 2048);
	assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]); assert.equal(end.error, undefined);
	assert.equal(end.tapSha256, sha256(tap));
	const output = tap.toString(), name = `installed primitive-base nominal C\\# packages reproduce and relocate ${route} ${mode}`;
	assert.ok(output.startsWith("TAP version 13\n")); assert.ok(output.includes(`\nok 1 - ${name}\n`));
	assert.match(output, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
	assert.doesNotMatch(output, /^not ok |# SKIP|# TODO|^Bail out!/gmu);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
};
