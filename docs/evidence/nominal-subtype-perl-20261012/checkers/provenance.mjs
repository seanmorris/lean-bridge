/**
 * Validate serial nominal CPAN producer invocations and terminal TAP results.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const nominalSubtypePerlSelections = Object.freeze([
	["ordinary", "full"], ["reviewed", "full"]
	, ["ordinary", "result-only"], ["reviewed", "result-only"]
]);

/**
 * Require exact route/mode gates, low-load scheduling and completed execution.
 *
 * @param options - Original runner records and independently selected identity.
 * @param options.start - Original process launch record.
 * @param options.end - Original terminal record.
 * @param options.tap - Complete original combined TAP output.
 * @param options.runner - Exact runner source bytes.
 * @param options.route - Independently selected author route.
 * @param options.mode - Independently selected API mode.
 * @param options.prefix - Original task-specific recording prefix.
 * @param options.producerCommit - Full frozen Git revision.
 * @param options.floor - Explicit package glibc floor.
 */
export const assertNominalSubtypePerlRun = ({ start, end, tap, runner, route, mode, prefix, producerCommit, floor }) => {
	assert.match(prefix, new RegExp(`^build/vo1444-nominal-perl-${route}-${mode}-r[0-9]+-${producerCommit.slice(0, 7)}$`, "u"));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	assert.equal(start.revision, producerCommit); assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.equal(start.runnerSha256, sha256(runner)); assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, ["-n", "19", "/usr/bin/ionice", "-c", "3"
		, "/usr/bin/taskset", "-c", "3", "/usr/bin/node", "--test"
		, "--test-concurrency=1"
		, "tests/helpers/nominal-subtype-perl-installed-tests.mjs"]);
	assert.deepEqual(start.environment, {
		LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_ROUTES: route
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_MODES: mode
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PERL_OUTPUT: prefix + "-records"
		, LEAN_BRIDGE_LEAN_PREFIX: "/app/.toolchains/elan/toolchains/leanprover--lean4---v4.32.2"
		, LEAN_BRIDGE_PERL_TEST_GLIBC_FLOOR: floor
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1"
	});
	assert.ok(start.initial.freeMiB >= 2048 && start.initial.availableMiB >= 2048 && start.initial.load < 6);
	assert.ok(end.minimum.freeMiB >= 768 && end.minimum.availableMiB >= 768);
	assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]); assert.equal(end.error, undefined);
	assert.equal(end.tapSha256, sha256(tap));
	assert.match(tap.toString(), /# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n/u);
	assert.ok(tap.toString().includes(`ok 1 - installed nominal Perl packages reproduce and relocate ${route} ${mode}\n`));
	assert.doesNotMatch(tap.toString(), /^not ok |# SKIP|# TODO/gmu);
	assert.ok(Date.parse(start.started) <= Date.parse(end.finished));
};
