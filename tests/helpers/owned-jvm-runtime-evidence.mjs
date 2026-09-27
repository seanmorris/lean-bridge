/**
 * Replay exact JVM lifetime probe sources without admitting installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { ownedJvmRuntime } from "../../src/backends/jvm/owned-runtime.mjs";
import { ownedJvmRuntimeProbeSources } from "./owned-jvm-runtime-native.mjs";

export const ownedJvmRuntimeReceipt = "docs/evidence/owned-jvm-runtime-20260927.json";
export const ownedJvmRuntimeSources = [
	"docs/evidence/owned-jvm-runtime-20260927.md"
	, "src/backends/jvm/owned-runtime.mjs"
	, "src/backends/jvm/owned-thread-exit.mjs"
	, "tests/fixtures/structured-types/OwnedRuntimeProbe.java"
	, "tests/helpers/owned-jvm-runtime-evidence.mjs"
	, "tests/helpers/owned-jvm-runtime-native.mjs"
	, "tests/owned-jvm-runtime-evidence.test.mjs"
	, "tests/owned-jvm-runtime.test.mjs"
].sort();
export const ownedJvmRuntimeScope = { compiledLean: true
	, platformThreadLeases: true, nativeThreadExit: true, closureLifetimes: true
	, virtualThreads: false, generalJvmForkSupport: false, installedMaven: false
	, publicJavaKotlinValues: false, wasm: false, promotedCells: 0 };

/**
 * Check complete compiler inputs, emitted native/Java code and observed cleanup.
 *
 * @param record - Frozen runtime foundation receipt.
 */
export const assertOwnedJvmRuntime = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-jvm-runtime-foundation");
	assert.equal(record.baselineRevision, "6e73096a2e309bca71106924a5276e0a2ddb0c8c");
	assert.deepEqual(record.scope, ownedJvmRuntimeScope);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedJvmRuntimeSources);
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(await readFile(path)), hash, path);
	assert.equal(record.run.command, "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test tests/owned-jvm-runtime.test.mjs");
	assert.equal(record.run.exitCode, 0); assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 3, pass: 3, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok/mu);
	assert.deepEqual(Object.keys(record.reports).sort(), ["ordinary", "reviewed"]);
	const lean = await readFile("tests/fixtures/onboarding/owned-host-callbacks/Owned.lean");
	for(const [mode, report] of Object.entries(record.reports))
	{
		assert.equal(report.schemaVersion, 1);
		assert.deepEqual(report.scope, { compiledLean: true, nativeTls: true, installedPackage: false });
		assert.equal(report.input.hostCallbacks, true);
		assert.equal(Boolean(report.input.sourceIdentity.reviewedBindingIr), mode === "reviewed");
		assert.equal(report.input.sourceIdentity.modules.length, 1);
		assert.equal(report.input.sourceIdentity.modules[0].source.sha256, sha256(lean));
		const native = ownedJvmRuntimeProbeSources(report.input);
		assert.equal(report.nativeSha256, sha256(native.implementation));
		assert.equal(report.guardSha256, sha256(native.guard));
		const runtime = ownedJvmRuntime(native.prefix);
		const instrumented = runtime.replace('"lean_bridge_native_process_valid"', '"owned_test_process_valid"')
			.replace("static void checkpoint() { }", "static void checkpoint() { OwnedRuntimeProbe.allocation(); }");
		assert.equal(report.runtimeSha256, sha256(runtime));
		assert.equal(report.instrumentedSha256, sha256(instrumented));
		assert.equal(report.probeSha256, record.sources["tests/fixtures/structured-types/OwnedRuntimeProbe.java"]);
		assert.deepEqual(report.observations, [
			{ checks: 139, exitErrors: 0, exits: 3, identities: 0, live: 0, mode: "ordinary" }
			, { checks: 7, exitErrors: 0, exits: 1, identities: 0, live: 0, mode: "retirement" }
		]);
	}
};
