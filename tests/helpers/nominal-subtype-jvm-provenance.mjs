/**
 * Authenticate original nominal JVM launch records, frozen sources and terminal TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const nominalSubtypeJvmSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

/**
 * Require a completed original selection, complete TAP and unchanged source map.
 *
 * @param options - Original launch, terminal records and independently selected pins.
 * @param options.start - Original pre-launch record.
 * @param options.end - Original terminal record.
 * @param options.tap - Complete original combined TAP bytes.
 * @param options.route - Ordinary or reviewed author route.
 * @param options.mode - Full or result-only API.
 * @param options.prefix - Task-specific original output prefix.
 * @param options.producerCommit - Full immutable producer revision.
 * @param options.floor - Explicit native glibc floor.
 */
export const assertNominalSubtypeJvmRun = ({ start, end, tap, route, mode, prefix, producerCommit, floor }) => {
	assert.ok(nominalSubtypeJvmSelections.some(selection => selection[0] === route && selection[1] === mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.match(prefix, new RegExp(`^build/vo1444-nominal-jvm-installed-${route}-${mode}-r[1-9][0-9]*$`, "u"));
	const fields = ["args", "attempt", "command", "environment", "mode"
		, "output", "producerCommit", "resources", "route", "sources"
		, "started", "tap"];
	assert.deepEqual(Object.keys(start).sort(), fields);
	assert.deepEqual(Object.keys(end).sort(), [...fields, "bytes", "code"
		, "finished", "sha256", "signal", "sourceChanges"].sort());
	for(const key of fields) assert.deepEqual(end[key], start[key], key);
	assert.equal(start.producerCommit, producerCommit); assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.equal(start.attempt, prefix.split("-").at(-1)); assert.equal(start.command, "/usr/bin/node");
	assert.deepEqual(start.args, ["--test", "--test-concurrency=1", "tests/helpers/nominal-subtype-jvm-installed-tests.mjs"]);
	assert.equal(start.tap, prefix + ".tap"); assert.ok(posix.isAbsolute(start.output));
	assert.ok(start.output.endsWith("/" + prefix + "-output"));
	assert.deepEqual(start.environment, {
		LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_ROUTES: route
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_MODES: mode
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_JVM_OUTPUT: start.output
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: floor
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	});
	const { resources } = start;
	assert.deepEqual(Object.keys(resources).sort(), ["observations", "waits"]);
	assert.ok(Number.isSafeInteger(resources.waits) && resources.waits >= 0 && resources.waits <= 20);
	assert.equal(resources.observations.length, resources.waits + 1);
	for(const [index, sample] of resources.observations.entries())
	{
		assert.deepEqual(Object.keys(sample).sort(), ["availableBytes", "freeBytes", "load"]);
		for(const key of ["availableBytes", "freeBytes"]) assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
		assert.equal(sample.load < 6, index === resources.waits);
	}
	assert.ok(Object.keys(start.sources).length > 0);
	for(const [path, digest] of Object.entries(start.sources))
	{
		assert.ok(/^(?:src|tests|scripts)\//u.test(path) && posix.normalize(path) === path);
		assert.match(digest, /^[a-f0-9]{64}$/u);
	}
	assert.deepEqual(end.sourceChanges, []); assert.equal(end.code, 0); assert.equal(end.signal, null);
	assert.equal(end.bytes, tap.length); assert.equal(end.sha256, sha256(tap));
	assert.ok(Number.isFinite(Date.parse(start.started)) && Date.parse(start.started) <= Date.parse(end.finished));
	const output = tap.toString();
	assert.ok(output.startsWith("TAP version 13\n"));
	assert.ok(output.includes(`\nok 1 - installed nominal JVM packages reproduce and relocate ${route} ${mode}\n`));
	assert.match(output, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
	assert.doesNotMatch(output, /^not ok |# SKIP|# TODO|^Bail out!/gmu);
};
