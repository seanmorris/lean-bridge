/**
 * Require real public WIT calls, callback lifetimes and mandatory CI execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedWitNativeExecution, ownedWitNativeScope } from "./wit-owned-native-evidence.mjs";

export const ownedWitSessionCommand = "node --test --test-concurrency=1 tests/wit-owned-session.test.mjs";
export const ownedWitSessionScope = Object.freeze({
	publicSession: true, hostCallbacks: true, compiledLean: true
	, ordinaryAndReviewed: true, generatedComponent: true
	, independentResourceLeases: true, returnedLeanClosures: true
	, callbackReentry: true, callbackClose: true, expiredCallbackBorrows: true
	, nineteenScalars: true, nativeAndScratchAllocationFaults: true
	, addressAndUndefinedSanitizers: true
	, installedPackages: false, transferredInputs: false
	, anchoredBorrowedResults: false, retainedHostCallbacks: false
	, installedSupportPromotions: 0
});

/**
 * Require both source paths, independent public consumers and complete regressions.
 *
 * @param record - Immutable source-bound public session receipt.
 */
export const assertOwnedWitSessionExecution = record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedWitSessionScope);
	assert.deepEqual(Object.keys(record.runs).sort(), ["nativeRegression", "sessions"]);
	const run = record.runs.sessions;
	assert.equal(run.command, ownedWitSessionCommand);
	assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
	for(const [key, count] of Object.entries({ tests: 7, pass: 7, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
		assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
	assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	const reports = [...run.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.deepEqual(reports.map(({ fixture, reviewed }) => [fixture, reviewed]),
		["values", "host callbacks", "scalars"].flatMap(fixture => [false, true].map(reviewed => [fixture, reviewed])));
	for(const report of reports)
	{
		assert.ok(report.checks > 100 && report.failures > 10);
		assert.equal(report.live, 0); assert.equal(report.identities, 0);
		assert.ok(report.componentCalls > 20); assert.equal(report.componentCalls, report.nativeImports);
		assert.ok(report.leanCalls > 10 && report.leanCalls <= report.nativeImports);
		if(report.fixture === "host callbacks") assert.ok(report.failures > 1000 && report.componentCalls > 3000);
		if(report.fixture === "scalars") assert.equal(report.primitives, 19);
	}
	for(const mutation of ["missing-store-lease-cleanup", "missing-independent-result-owner"])
		assert.ok(run.text.includes(`rejected mutation: ${mutation}`));
	assertOwnedWitNativeExecution({ acceptance: "passed"
		, scope: ownedWitNativeScope
		, runs: { native: record.runs.nativeRegression } });
};

const step = (job, name) => {
	const value = job.split(`      - name: ${name}\n`)[1]?.split("      - name:")[0];
	assert.ok(value, name); return value;
};

/**
 * Require enabled public execution, no-skip TAP, artifacts and failure propagation.
 *
 * @param workflow - Complete downstream workflow source.
 */
export const assertOwnedWitSessionCi = workflow => {
	const job = workflow.split("  wasi-consumer:\n")[1]?.split("  docker-engine:\n")[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	const execute = step(job, "Execute owned WIT public sessions and host callbacks");
	assert.doesNotMatch(execute, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(execute, /^ {8}id: owned_wit_session$/mu);
	assert.match(execute, /^ {10}LEAN_BRIDGE_WIT_OWNED_SESSION_TEST: "1"$/mu);
	assert.equal(execute.split("        run: |\n")[1].trim().split("\n").map(line => line.trim()).join("\n"), [
		"set -euo pipefail"
		, 'export LEAN_BRIDGE_WASMTIME_C_API="$PWD/build/wasmtime-c-api"'
		, "source scripts/env.sh"
		, ownedWitSessionCommand + " 2>&1 | tee build/wit-owned-session.log"
		, "test -s build/wit-owned-session.log"
		, "rg '^# pass 7$' build/wit-owned-session.log"
		, "rg '^# fail 0$' build/wit-owned-session.log"
		, "rg '^# skipped 0$' build/wit-owned-session.log"
	].join("\n"));
	const upload = step(job, "Preserve owned WIT public session execution");
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}path: build\/wit-owned-session.log$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	assert.doesNotMatch(upload, /^ {8}continue-on-error:/mu);
	assert.match(step(job, "Enforce WIT and WASI support"), /steps\.owned_wit_session\.outcome != 'success'/u);
	const observations = step(job, "Record WIT and WASI observations");
	for(const name of ["test_result", "executed"])
		assert.match(observations.split(`          ${name}=`)[1]?.split("\n")[0] ?? "", /steps\.owned_wit_session\.outcome == 'success'/u);
	assert.ok(workflow.split("  support-summary:\n")[1]?.split("    runs-on:")[0].includes("      - wasi-consumer\n"));
};
