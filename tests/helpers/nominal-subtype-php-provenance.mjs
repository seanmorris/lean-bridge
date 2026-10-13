/**
 * Authenticate original nominal PHP selections, resource guards and terminal TAP.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";

export const nominalSubtypePhpSelections = Object.freeze([
	["ordinary", "full"], ["ordinary", "result-only"]
	, ["reviewed", "full"], ["reviewed", "result-only"]
]);

/**
 * Require strict disk/memory floors and bounded waiting for load below six.
 *
 * @param resource - Original guard observations.
 */
export const assertNominalSubtypePhpResources = resource => {
	assert.deepEqual(Object.keys(resource).sort(), ["observations", "waits"]);
	assert.ok(Number.isSafeInteger(resource.waits) && resource.waits >= 0 && resource.waits <= 20);
	assert.equal(resource.observations.length, resource.waits + 1);
	for(const [index, sample] of resource.observations.entries())
	{
		assert.deepEqual(Object.keys(sample).sort(), ["availableBytes", "freeBytes", "load"]);
		for(const key of ["availableBytes", "freeBytes"]) assert.ok(Number.isSafeInteger(sample[key]) && sample[key] >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(sample.load) && sample.load >= 0);
		assert.equal(sample.load < 6, index === resource.waits);
	}
};

/**
 * Authenticate one complete serial original run and its unchanged input snapshot.
 *
 * @param options - Original records and independent selection.
 * @param options.start - Original pre-launch record.
 * @param options.end - Original terminal record.
 * @param options.tap - Complete original combined TAP output.
 * @param options.runner - Retained original runner bytes.
 * @param options.route - Ordinary or reviewed route.
 * @param options.mode - Full or standalone result-only API.
 * @param options.prefix - Original task-specific output prefix.
 * @param options.producerCommit - Full immutable source revision.
 * @param options.floor - Explicit package glibc floor.
 * @param options.phpVersion - Exact selected PHP version.
 * @param options.composerVersion - Exact selected Composer version.
 */
export const assertNominalSubtypePhpRun = ({ start, end, tap, runner, route, mode, prefix, producerCommit, floor, phpVersion, composerVersion }) => {
	assert.ok(nominalSubtypePhpSelections.some(selection => selection[0] === route && selection[1] === mode));
	assert.match(producerCommit, /^[a-f0-9]{40}$/u); assert.match(floor, /^2\.[0-9]+$/u);
	assert.match(prefix, new RegExp(`^build/vo1466-nominal-php-installed-${route}-${mode}-r[1-9][0-9]*$`, "u"));
	assert.deepEqual(Object.keys(start).sort(), [
		"args", "command", "cwd", "environment", "mode", "producerCommit"
		, "resources", "route", "runnerSha256", "schemaVersion"
		, "sources", "started"]);
	assert.deepEqual(Object.keys(end).sort(), [
		"added", "changed", "code", "finished", "head", "mode", "producerCommit"
		, "removed", "route", "schemaVersion", "signal", "sourcesChecked"
		, "started", "tapBytes", "tapSha256"]);
	for(const key of ["mode", "producerCommit", "route", "schemaVersion", "started"]) assert.equal(end[key], start[key], key);
	assert.equal(start.schemaVersion, 1); assert.equal(start.producerCommit, producerCommit);
	assert.equal(start.route, route); assert.equal(start.mode, mode); assert.equal(start.command, "/usr/bin/node");
	assert.equal(typeof start.cwd, "string");
	assert.ok(posix.isAbsolute(start.cwd) && posix.normalize(start.cwd) === start.cwd && !start.cwd.includes("\0"));
	assert.equal(start.runnerSha256, sha256(runner));
	assert.deepEqual(start.args, ["--test", "--test-concurrency=1", "--test-reporter=tap", "tests/helpers/nominal-subtype-php-installed-tests.mjs"]);
	assert.deepEqual(start.environment, {
		LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_TEST: "1"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_ROUTES: route
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_MODES: mode
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_OUTPUT: posix.join(start.cwd, prefix + "-output")
		, LEAN_BRIDGE_PHP: "/usr/bin/php", LEAN_BRIDGE_COMPOSER: "/usr/bin/composer"
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_VERSION: phpVersion
		, LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_COMPOSER_VERSION: composerVersion
		, LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: floor
		, LEAN_NUM_THREADS: "1", OMP_NUM_THREADS: "1", MAKEFLAGS: "-j1", NO_COLOR: "1"
	});
	assertNominalSubtypePhpResources(start.resources);
	assert.equal(end.sourcesChecked, Object.keys(start.sources).length); assert.ok(end.sourcesChecked > 0);
	for(const [path, digest] of Object.entries(start.sources))
	{
		assert.ok(/^(?:src|scripts|tests)\//u.test(path) && posix.normalize(path) === path && !path.includes("\0"));
		assert.match(digest, /^[a-f0-9]{64}$/u);
	}
	for(const key of ["added", "removed", "changed"]) assert.deepEqual(end[key], []);
	assert.equal(end.head, producerCommit); assert.equal(end.code, 0); assert.equal(end.signal, null);
	assert.equal(end.tapBytes, tap.length); assert.equal(end.tapSha256, sha256(tap));
	assert.ok(Number.isFinite(Date.parse(start.started)) && Date.parse(start.started) <= Date.parse(end.finished));
	const output = tap.toString();
	assert.ok(output.startsWith("TAP version 13\n"));
	assert.ok(output.includes(`\nok 1 - installed nominal PHP packages reproduce and relocate ${route} ${mode}\n`));
	assert.match(output, /\n1\.\.1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms [0-9]+(?:\.[0-9]+)?\n$/u);
	assert.doesNotMatch(output, /^not ok |# SKIP|# TODO|^Bail out!/gmu);
};
