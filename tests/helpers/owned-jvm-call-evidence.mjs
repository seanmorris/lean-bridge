/**
 * Authenticate both JVM callback families and preserve converter evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedJvmCalls } from "../../src/backends/jvm/owned-calls.mjs";
import { ownedJvmCallNative, ownedJvmCallProbeMethods } from "./owned-jvm-call-fixture.mjs";
import { assertOwnedJvmConversions, ownedJvmConversionReceipt } from "./owned-jvm-conversion-evidence.mjs";

export const ownedJvmCallReceipt = "docs/evidence/owned-jvm-calls-20260927.json";
export const ownedJvmCallCommand = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-calls.test.mjs";
export const ownedJvmCallScope = {
	compiledLean: true, ordinaryAndReviewed: true, scalarKinds: 19
	, javaAndKotlin: true, hostUpcalls: true, higherOrderClosures: true
	, callbackRecovery: true, callbackRetirement: true, nativeThreadExit: true
	, allocationRollback: true, installedMaven: false
	, transferredInputs: false, anchoredResults: false, wasm: false
	, promotedCells: 0
};
export const ownedJvmCallSources = [
	"docs/evidence/owned-jvm-calls-20260927.md"
	, "src/backends/jvm/owned-calls.mjs"
	, "src/backends/jvm/owned-callables.mjs"
	, "src/backends/jvm/owned-kotlin.mjs"
	, "tests/helpers/owned-jvm-call-fixture.mjs"
	, "tests/helpers/owned-jvm-call-evidence.mjs"
	, "tests/helpers/owned-dotnet-callback-fixture.mjs"
	, "tests/owned-jvm-calls.test.mjs"
	, "tests/owned-jvm-call-evidence.test.mjs"
	, "tests/fixtures/structured-types/owned-jvm-calls.java"
	, ...["values", "scalars", "signatures"].flatMap(kind => [
		`tests/fixtures/structured-types/owned-jvm-callback-${kind}.java`
		, `tests/fixtures/structured-types/owned-kotlin-callback-${kind}.kt`
	])
].sort();
export const ownedJvmCallStatistics = {
	values: { javaChecks: 587, kotlinChecks: 539, managedFailures: 306, nativeFailures: 210, live: 0, identities: 0, threadExits: 5, threadExitErrors: 0 }
	, scalars: { javaChecks: 175, kotlinChecks: 170, managedFailures: 110, nativeFailures: 46, live: 0, identities: 0, threadExits: 0, threadExitErrors: 0 }
	, signatures: { javaChecks: 649, kotlinChecks: 192, managedFailures: 255, nativeFailures: 121, live: 0, identities: 0, threadExits: 1, threadExitErrors: 0 }
};

/**
 * Reconstruct generated native/JVM code and independently authored consumers.
 *
 * @param record - Frozen compiler inputs and terminal execution observations.
 */
export const assertOwnedJvmCalls = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-jvm-calls");
	assert.deepEqual(record.scope, ownedJvmCallScope);
	assert.deepEqual(record.previous, { path: ownedJvmConversionReceipt
		, sha256: "02c03e89a95ae9833e07a57fb248b3c5c2f04edab9fc4a16222c0d379bd54aed" });
	const previous = await readFile(record.previous.path);
	assert.equal(sha256(previous), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedJvmCallSources);
	for(const [path, hash] of Object.entries(record.sources)) assert.equal(sha256(await readFile(path)), hash, path);
	assert.equal(record.run.command, ownedJvmCallCommand); assert.equal(record.run.exitCode, 0);
	assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 7, pass: 7, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok/mu);
	const modes = ["values", "scalars", "signatures"].flatMap(kind => [kind + "-ordinary", kind + "-reviewed"]).sort();
	assert.deepEqual(Object.keys(record.reports).sort(), modes);
	const template = await readFile("tests/fixtures/structured-types/owned-jvm-calls.java", "utf8");
	for(const [mode, report] of Object.entries(record.reports))
	{
		const kind = mode.split("-")[0], reviewed = mode.endsWith("reviewed");
		const fixture = { values: "owned-cpp-composition", scalars: "owned-scalars", signatures: "owned-dotnet-callables" }[kind];
		assert.equal(report.installedPackage, false); assert.equal(report.input.hostCallbacks, true);
		assert.equal(Boolean(report.input.sourceIdentity.reviewedBindingIr), reviewed);
		assert.equal(report.input.sourceIdentity.modules.length, 1);
		assert.equal(report.input.sourceIdentity.modules[0].source.sha256, sha256(await readFile(`tests/fixtures/onboarding/${fixture}/Owned.lean`)));
		const native = ownedJvmCallNative(report.input), model = generateOwnedJvmCalls(native.c.layout.model.bindingIr);
		assert.equal(report.cSourceSha256, sha256(native.implementation));
		assert.equal(report.guardSha256, sha256(native.cleanup.guardSource));
		assert.deepEqual(report.files, Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)])));
		const runtime = Object.entries(model.files).find(([path]) => path.endsWith("/_OwnedRuntime.java"))[1];
		assert.equal(report.instrumentedRuntimeSha256, sha256(runtime.replace("static void checkpoint() { }", "static void checkpoint() { OwnedCallProbe.allocation(); }")));
		const exercise = await readFile(`tests/fixtures/structured-types/owned-jvm-callback-${kind}.java`, "utf8");
		const java = template.replace("/* METHODS */", () => ownedJvmCallProbeMethods(model)).replace("/* EXERCISE */", () => exercise);
		const kotlin = (await readFile(`tests/fixtures/structured-types/owned-kotlin-callback-${kind}.kt`, "utf8"))
			.replace("/* METHODS */", () => ownedJvmCallProbeMethods(model, true));
		assert.equal(report.javaProbeSha256, sha256(java)); assert.equal(report.kotlinProbeSha256, sha256(kotlin));
		const expected = ownedJvmCallStatistics[kind];
		assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key => [key, report[key]])), expected);
		assert.ok(record.run.text.includes("# " + JSON.stringify(expected)));
		assert.deepEqual(report.retirement, kind === "values" ? ["java", "kotlin"].map(language => ({ language, checks: 3, live: 0, identities: 0 })) : []);
	}
	await assertOwnedJvmConversions(JSON.parse(previous.toString("utf8")));
};
