/**
 * Verify the reproduced GCC failure and real native/wasm32 lifetime checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";

const sdk = "LEAN_BRIDGE_ZEND_PHP=/app/.toolchains/php-8.5.10-ffi/bin/php LEAN_BRIDGE_ZEND_PHP_CONFIG=/app/.toolchains/php-8.5.10-ffi/bin/php-config";
const gcc13 = 'PATH="/app/.toolchains/owned-gcc13/bin:$PATH" ';
const fiber = "LEAN_BRIDGE_OWNED_ZEND_FIBER_TEST=1 node --test --test-name-pattern='real Fiber entry' tests/owned-php-zend-ownership.test.mjs";
export const ownedZendBailoutCommands = Object.freeze({
	before: gcc13 + sdk + " " + fiber
	, execution: gcc13 + sdk + " LEAN_BRIDGE_OWNED_ZEND_FIBER_TEST=1 LEAN_BRIDGE_OWNED_PHP_ZEND_TEST=1 EMCC_CORES=2 node --test --test-concurrency=1 tests/owned-php-zend-ownership.test.mjs"
	, gcc12: sdk + " " + fiber
});
export const ownedZendBailoutScope = Object.freeze({
	probeOnly: true, productionUnchanged: true, compilerWarningsFatal: true
	, nativeFiberExecution: true, wasmBailoutCases: 14, gccMajors: [12, 13]
	, installedSupportPromotions: 0
});
const empty = stats => {
	for(const key of ["live", "leases", "pending", "identities", "scopes"]) assert.equal(stats[key], 0, key);
	assert.equal(stats.current, false); assert.equal(stats.retired, false);
};
const observations = run => [...run.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
const native = (report, major) => {
	assert.equal(report.profile, "native-zend-owned-lifetime-fibers"); assert.equal(report.wasm32, false);
	assert.match(report.compilerVersion, new RegExp("\\b" + major + "\\.\\d+\\.\\d+", "u"));
	assert.deepEqual(report.rejectedMutations, ["early-context-release", "late-borrow-expiry", "missing-fiber-guard", "lost-original-exception"]);
	assert.deepEqual(report.observations.map(item => item.strict), [0, 1]);
	for(const item of report.observations)
	{
		assert.equal(item.fiberExecution, true); assert.equal(item.stats.phpBits, 64);
		assert.equal(item.checks, 417); empty(item.stats);
		assert.deepEqual(item.faults, { coldNew: 5, new: 4, view: 1, retain: 4, borrow: 4, borrowRetain: 8, check: 2 });
	}
};

/**
 * Require both compilers, genuine Fibers and all wasm32 request-abort cases.
 *
 * @param record - Source-bound repair receipt with complete TAP output.
 */
export const assertOwnedZendBailoutExecution = async record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedZendBailoutScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedZendBailoutCommands).sort());
	for(const [name, tests, pass, fail] of [["before", 1, 0, 1], ["execution", 2, 2, 0], ["gcc12", 1, 1, 0]])
	{
		const run = record.runs[name]; assert.equal(run.command, ownedZendBailoutCommands[name]);
		assert.equal(run.exitCode, fail ? 1 : 0); assert.equal(sha256(run.text), run.sha256);
		for(const [key, count] of Object.entries({ tests, pass, fail, cancelled: 0, skipped: 0, todo: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
		assert.doesNotMatch(run.text, /# SKIP|# TODO/u);
		if(!fail) assert.doesNotMatch(run.text, /^not ok/mu);
	}
	assert.match(record.runs.before.text, /variable .value. might be clobbered/u);
	assert.match(record.runs.before.text, /variable .active. might be clobbered/u);
	assert.match(record.runs.before.text, /Werror=clobbered/u);
	const reports = observations(record.runs.execution); assert.equal(reports.length, 2);
	const [wasm, gcc13] = reports; native(gcc13, 13);
	const gcc12 = observations(record.runs.gcc12); assert.equal(gcc12.length, 1); native(gcc12[0], 12);
	assert.deepEqual(gcc12[0].files, gcc13.files, "Both compilers must execute identical C and PHP probes");
	assert.deepEqual(wasm.observations.map(item => item.strict), [0, 1]);
	for(const item of wasm.observations)
	{
		assert.equal(item.checks, 403); assert.equal(item.fiberExecution, false);
		assert.equal(item.stats.phpBits, 32); empty(item.stats);
		assert.deepEqual(item.faults, gcc13.observations[0].faults);
	}
	assert.deepEqual(wasm.bailouts.map(({ strict, mode }) => [strict, mode]), [0, 1].flatMap(strict => Array.from({ length: 7 }, (_, mode) => [strict, mode])));
	for(const item of wasm.bailouts)
	{
		assert.equal(item.status, [0, 1, 5].includes(item.mode) ? 0 : 1);
		empty(item.before); empty(item.after);
	}
	const helper = await readFile("tests/helpers/owned-php-zend-native.mjs", "utf8");
	assert.match(helper, /"-Wall", "-Wextra", "-Werror"/u);
	assert.doesNotMatch(helper, /-Wno-(?:error|clobbered)|-O0/u);
};
