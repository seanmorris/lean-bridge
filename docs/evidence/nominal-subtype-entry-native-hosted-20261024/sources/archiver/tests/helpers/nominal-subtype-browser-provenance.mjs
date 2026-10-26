/**
 * Authenticate original nominal browser launch records without following historical paths.
 *
 * @file
 */
import assert from "node:assert/strict";
import { posix } from "node:path";
import { sha256 } from "../../src/capsule/node.mjs";
import { nominalSubtypeBrowserRoutes, nominalSubtypeBrowserModes } from "./nominal-subtype-browser-fixture.mjs";

export const nominalSubtypeBrowserSelections = Object.freeze(nominalSubtypeBrowserRoutes.flatMap(route => nominalSubtypeBrowserModes.map(mode => [route, mode])));
const exactKeys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const digest = value => assert.match(value, /^[a-f0-9]{64}$/u);
const absolute = value => {
	assert.equal(typeof value, "string"); assert.ok(posix.isAbsolute(value));
	assert.equal(posix.normalize(value), value); assert.ok(!value.includes("\0"));
};
const selection = (route, mode) => assert.ok(nominalSubtypeBrowserSelections.some(pair => pair[0] === route && pair[1] === mode));

/**
 * Reject skipped, partial, duplicated, failed or appended installed TAP.
 *
 * @param source - Complete original combined producer output.
 * @param route - Explicit author route.
 * @param mode - Explicit full or constructor-free result-only API.
 */
export const assertNominalSubtypeBrowserTap = (source, route, mode) => {
	selection(route, mode);
	const name = `installed npm nominal Subtypes reproduce and relocate ${route} ${mode}`;
	assert.equal(typeof source, "string"); assert.ok(source.startsWith("TAP version 13\n"));
	assert.doesNotMatch(source, /^not ok |^Bail out!|# SKIP|# TODO/gmu);
	assert.doesNotMatch(source, /^[ \t]+(?:ok |not ok |# Subtest:|Bail out!)/gmu);
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

const resources = (value, floor) => {
	exactKeys(value, ["freeMiB", "availableMiB", "load"]);
	for(const key of ["freeMiB", "availableMiB"])
		assert.ok(Number.isSafeInteger(value[key]) && value[key] >= floor, key);
	assert.ok(Number.isFinite(value.load) && value.load >= 0);
};

/**
 * Bind terminal evidence to the actual frozen producer, launcher and pre-launch runtime.
 *
 * @param options - Original records and independently pinned archive selection.
 * @param options.start - Pre-launch input snapshot.
 * @param options.end - Original terminal result.
 * @param options.tap - Complete original TAP bytes.
 * @param options.route - Expected source route.
 * @param options.mode - Expected API mode.
 * @param options.producerCommit - Immutable original producer revision.
 * @param options.runtime - Independently pinned producer runtime.
 * @param options.runner - Original launcher bytes.
 */
export const assertNominalSubtypeBrowserRun = ({ start, end, tap, route, mode, producerCommit, runtime, runner }) => {
	selection(route, mode); assert.match(producerCommit, /^[a-f0-9]{40}$/u);
	exactKeys(start, ["producerCommit", "route", "mode", "attempt", "runnerSha256", "runtime", "nodeExecutable", "command", "args", "environment", "inheritedEnvironmentSha256", "sources", "initial", "guard", "started"]);
	exactKeys(end, ["code", "signal", "finished", "minimum", "final", "stopReason", "tapSha256", "sourcesChecked", "changed", "runnerUnchanged", "headUnchanged", "trackedClean"]);
	assert.equal(start.producerCommit, producerCommit); assert.equal(start.route, route); assert.equal(start.mode, mode);
	assert.match(start.attempt, /^r[1-9][0-9]*$/u); assert.equal(start.runnerSha256, sha256(runner));
	exactKeys(runtime, ["node", "platform", "arch"]); assert.match(runtime.node, /^v[0-9]+\.[0-9]+\.[0-9]+$/u);
	assert.equal(runtime.platform, "linux"); assert.equal(runtime.arch, "x64"); assert.deepEqual(start.runtime, runtime);
	exactKeys(start.nodeExecutable, ["path", "bytes", "sha256"]); absolute(start.nodeExecutable.path);
	assert.ok(Number.isSafeInteger(start.nodeExecutable.bytes) && start.nodeExecutable.bytes > 0); digest(start.nodeExecutable.sha256);
	assert.equal(start.command, "/usr/bin/nice");
	assert.deepEqual(start.args, [
		"-n", "19", "/usr/bin/ionice", "-c", "3"
		, "/usr/bin/taskset", "-c", "3", start.nodeExecutable.path
		, "--max-old-space-size=3072"
		, "--test"
		, "--test-concurrency=1"
		, "--test-reporter=tap"
		, "tests/helpers/nominal-subtype-npm-installed-tests.mjs"]);
	const environment = start.environment;
	exactKeys(environment, [
		"NO_COLOR", "LEAN_NUM_THREADS", "OMP_NUM_THREADS", "MAKEFLAGS"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST"
		, "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES"
		, "LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT"
		, "PLAYWRIGHT_BROWSERS_PATH"
		, "LEAN_BRIDGE_LAKE_RUNTIME_ROOT"
		, "LEAN_BRIDGE_LEAN_PREFIX"]);
	for(const key of ["NO_COLOR", "LEAN_NUM_THREADS", "OMP_NUM_THREADS", "LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST", "LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST"])
		assert.equal(environment[key], "1", key);
	assert.equal(environment.MAKEFLAGS, "-j1"); assert.equal(environment.LEAN_BRIDGE_TYPE_CORPUS_BROWSERS, "chromium,firefox,webkit");
	assert.equal(environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ROUTES, route); assert.equal(environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_MODES, mode);
	for(const key of ["LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT", "PLAYWRIGHT_BROWSERS_PATH", "LEAN_BRIDGE_LAKE_RUNTIME_ROOT", "LEAN_BRIDGE_LEAN_PREFIX"])
		absolute(environment[key]);
	assert.ok(environment.LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_OUTPUT.endsWith(`/build/vo1468-browser-installed-${route}-${mode}-${start.attempt}-${producerCommit.slice(0, 7)}/records`));
	digest(start.inheritedEnvironmentSha256);
	assert.ok(Object.keys(start.sources).length > 0); assert.equal(end.sourcesChecked, Object.keys(start.sources).length);
	for(const [path, hash] of Object.entries(start.sources))
	{
		assert.ok(/^(?:src|scripts|tests)\//u.test(path) || ["package.json", "package-lock.json", ".github/workflows/consumer-matrix.yml", ".github/workflows/checked-record-browser.yml", "docs/type-surface.v1.json"].includes(path));
		assert.equal(posix.normalize(path), path); assert.ok(!path.includes("\0")); digest(hash);
	}
	resources(start.initial, 2048); assert.ok(start.initial.load < 6);
	exactKeys(start.guard, ["waits", "observations"]);
	assert.ok(Number.isSafeInteger(start.guard.waits) && start.guard.waits >= 0 && start.guard.waits <= 20);
	assert.equal(start.guard.observations.length, start.guard.waits + 1);
	for(const [index, value] of start.guard.observations.entries())
	{
		exactKeys(value, ["freeBytes", "availableBytes", "load"]);
		assert.ok(Number.isSafeInteger(value.freeBytes) && value.freeBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isSafeInteger(value.availableBytes) && value.availableBytes >= 2 * 1024 ** 3);
		assert.ok(Number.isFinite(value.load) && value.load >= 0);
		assert.ok(index === start.guard.waits ? value.load < 6 : value.load >= 6);
	}
	exactKeys(end.minimum, ["freeMiB", "availableMiB"]);
	for(const key of ["freeMiB", "availableMiB"])
		assert.ok(Number.isSafeInteger(end.minimum[key]) && end.minimum[key] >= 768 && end.minimum[key] <= start.initial[key]);
	resources(end.final, 768);
	assert.deepEqual([end.code, end.signal, end.stopReason], [0, null, null]); assert.deepEqual(end.changed, []);
	for(const key of ["runnerUnchanged", "headUnchanged", "trackedClean"]) assert.equal(end[key], true, key);
	assert.equal(end.tapSha256, sha256(tap));
	assert.ok(Number.isFinite(Date.parse(start.started)) && Date.parse(start.started) <= Date.parse(end.finished));
	assertNominalSubtypeBrowserTap(tap.toString(), route, mode);
};
