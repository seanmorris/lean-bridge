/**
 * Require observed native Lean calls, conversion faults and mandatory WIT CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

export const ownedWitNativeCommand = "node --test --test-concurrency=1 tests/wit-owned-graph-conversions.test.mjs tests/wit-owned-native-host.test.mjs";
export const ownedWitNativeScope = Object.freeze({
	converters: true, compiledLean: true, ordinaryAndReviewed: true
	, generatedComponent: true, independentResourceLeases: true
	, returnedLeanClosures: true, addressAndUndefinedSanitizers: true
	, allocationFaults: true, privateHostOnly: true
	, hostCallbacks: false, publicSession: false, installedPackages: false
	, transferredInputs: false, anchoredBorrowedResults: false
	, installedSupportPromotions: 0
});

/**
 * Require complete no-skip execution, balanced ownership and rejected mutations.
 *
 * @param record - Immutable source-bound native WIT execution receipt.
 */
export const assertOwnedWitNativeExecution = record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedWitNativeScope);
	assert.deepEqual(Object.keys(record.runs), ["native"]);
	const run = record.runs.native;
	assert.equal(run.command, ownedWitNativeCommand);
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	for(const [key, count] of Object.entries({ tests: 5, pass: 5, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	const reports = [...run.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(reports.length, 3);
	const [conversions, ...native] = reports;
	assert.equal(conversions.scalars, 19); assert.equal(conversions.roundtrips, 58);
	assert.equal(conversions.created, conversions.dropped); assert.ok(conversions.created > 2000);
	assert.equal(conversions.liveResources, 0); assert.equal(conversions.liveAllocations, 0);
	assert.equal(conversions.scratchFailures, conversions.inputAllocationSites + conversions.outputAllocationSites);
	assert.ok(conversions.scratchFailures > 0 && conversions.budgetFailures > 100);
	assert.ok(conversions.malformedInputs >= 7 && conversions.malformedOutputs >= 4 && conversions.identityFailures >= 4);
	assert.deepEqual(native.map(item => item.reviewed), [false, true]);
	for(const report of native)
	{
		assert.equal(report.calls, 557); assert.equal(report.resources, 248);
		assert.equal(report.shapes, 49); assert.equal(report.closures, 2);
		assert.equal(report.allocationFailures, 6);
		assert.equal(report.liveIdentities, 0); assert.equal(report.liveAllocations, 0);
	}
	for(const text of ["rejected mutations: missing resource cleanup; unreachable node admission"
		, "rejected mutation: missing-output-lease"
		, "rejected mutation: missing-pending-rollback"])
		assert.ok(run.text.includes(text), text);
};

const step = (job, name) => {
	const value = job.split(`      - name: ${name}\n`)[1]?.split("      - name:")[0];
	assert.ok(value, name); return value;
};

/**
 * Require tools, enabled execution, no-skip TAP and preserved failure visibility.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedWitNativeCi = workflow => {
	const job = workflow.split("  wasi-consumer:\n")[1]?.split("  docker-engine:\n")[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	const execute = step(job, "Execute owned WIT conversions and compiled Lean imports");
	assert.doesNotMatch(execute, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(execute, /^ {8}id: owned_wit_native$/mu);
	assert.match(execute, /^ {10}LEAN_BRIDGE_WIT_OWNED_CONVERSIONS_TEST: "1"$/mu);
	assert.match(execute, /^ {10}LEAN_BRIDGE_WIT_OWNED_NATIVE_TEST: "1"$/mu);
	assert.equal(execute.split("        run: |\n")[1].trim().split("\n").map(line => line.trim()).join("\n"), [
		"set -euo pipefail"
		, 'export LEAN_BRIDGE_WASMTIME_C_API="$PWD/build/wasmtime-c-api"'
		, "source scripts/env.sh"
		, ownedWitNativeCommand + " 2>&1 | tee build/wit-owned-native.log"
		, "test -s build/wit-owned-native.log"
		, "rg '^# pass 5$' build/wit-owned-native.log"
		, "rg '^# fail 0$' build/wit-owned-native.log"
		, "rg '^# skipped 0$' build/wit-owned-native.log"
	].join("\n"));
	const upload = step(job, "Preserve owned WIT native execution");
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}path: build\/wit-owned-native.log$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	assert.doesNotMatch(upload, /^ {8}continue-on-error:/mu);
	assert.match(step(job, "Enforce WIT and WASI support"), /steps\.owned_wit_native\.outcome != 'success'/u);
	const observations = step(job, "Record WIT and WASI observations");
	for(const name of ["test_result", "executed"])
		assert.match(observations.split(`          ${name}=`)[1]?.split("\n")[0] ?? "", /steps\.owned_wit_native\.outcome == 'success'/u);
	assert.ok(workflow.split("  support-summary:\n")[1]?.split("    runs-on:")[0].includes("      - wasi-consumer\n"));
};
