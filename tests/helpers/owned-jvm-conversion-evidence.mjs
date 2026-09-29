/**
 * Bind Java conversion observations to exact native and generated JVM sources.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { generateOwnedJvmConversions } from "../../src/backends/jvm/owned-conversions.mjs";
import { ownedJvmConversionNative } from "./owned-jvm-conversion-native.mjs";
import { ownedJvmConversionProbeSource } from "./owned-jvm-conversion-calls.mjs";
import { assertOwnedJvmRuntime, ownedJvmRuntimeReceipt } from "./owned-jvm-runtime-evidence.mjs";
import { ownedJvmTransferHistoricalBytes } from "./owned-jvm-transfer-history.mjs";

export const ownedJvmConversionReceipt = "docs/evidence/owned-jvm-conversions-20260927.json";
export const ownedJvmConversionCommand = "LEAN_BRIDGE_OWNED_NATIVE_TEST=1 node --test --test-concurrency=1 tests/owned-jvm-conversions.test.mjs";
export const ownedJvmConversionScope = {
	compiledLean: true, ordinaryAndReviewed: true, scalarKinds: 19
	, javaSnapshots: true, returnedClosures: true, inputLeasePins: true
	, allocationRollback: true, hostUpcalls: false, kotlinValues: false
	, installedMaven: false, wasm: false, promotedCells: 0
};
export const ownedJvmConversionSources = [
	"docs/evidence/owned-jvm-conversions-20260927.md"
	, "src/backends/jvm/owned-conversion-runtime.mjs"
	, "src/backends/jvm/owned-conversions.mjs"
	, "src/backends/jvm/owned-scalars.mjs"
	, "src/backends/jvm/owned-runtime.mjs", "src/backends/jvm/owned-layout.mjs"
	, "src/backends/jvm/owned-values.mjs", "src/backends/jvm/owned-thread-exit.mjs"
	, "src/backends/jvm/copied-graph-equality.mjs"
	, "tests/helpers/owned-jvm-conversion-calls.mjs"
	, "tests/helpers/owned-jvm-conversion-native.mjs"
	, "tests/helpers/owned-jvm-conversion-evidence.mjs"
	, "tests/owned-jvm-conversions.test.mjs"
	, "tests/owned-jvm-conversion-evidence.test.mjs"
	, "tests/fixtures/structured-types/owned-jvm-conversions.java"
	, "tests/fixtures/structured-types/owned-jvm-compositions.java"
	, "tests/fixtures/structured-types/owned-jvm-scalars.java"
].sort();

/**
 * Rebuild every generated source and preserve the earlier runtime receipt.
 *
 * @param record - Frozen compiler inputs, sources and terminal execution log.
 */
export const assertOwnedJvmConversions = async record => {
	assert.equal(record.schemaVersion, 1); assert.equal(record.planNode, 1219);
	assert.equal(record.kind, "owned-jvm-conversions");
	assert.deepEqual(record.scope, ownedJvmConversionScope);
	assert.deepEqual(record.previous, { path: ownedJvmRuntimeReceipt
		, sha256: "db90f4126d6e4454f16d372637a3dac5ddd1f67f557cb2fd43b7d1adbe688d57" });
	const previousBytes = await readFile(record.previous.path);
	assert.equal(sha256(previousBytes), record.previous.sha256);
	assert.deepEqual(Object.keys(record.sources).sort(), ownedJvmConversionSources);
	for(const [path, hash] of Object.entries(record.sources))
		assert.equal(sha256(ownedJvmTransferHistoricalBytes(path, await readFile(path), hash)), hash, path);
	assert.equal(record.run.command, ownedJvmConversionCommand);
	assert.equal(record.run.exitCode, 0); assert.equal(record.run.sha256, sha256(record.run.text));
	for(const [name, count] of Object.entries({ tests: 5, pass: 5, fail: 0, skipped: 0, cancelled: 0 }))
		assert.match(record.run.text, new RegExp("^# " + name + " " + count + "$", "mu"));
	assert.doesNotMatch(record.run.text, /^not ok/mu);
	assert.deepEqual(Object.keys(record.reports).sort(), ["ordinary", "reviewed", "scalars-ordinary", "scalars-reviewed"]);
	const template = await readFile("tests/fixtures/structured-types/owned-jvm-conversions.java", "utf8");
	for(const [mode, report] of Object.entries(record.reports))
	{
		const scalar = mode.startsWith("scalars-"), reviewed = mode.endsWith("reviewed");
		const fixture = scalar ? "owned-scalars" : "owned-cpp-composition";
		assert.equal(report.installedPackage, false); assert.equal(report.hostUpcalls, false);
		assert.equal(report.input.hostCallbacks, true);
		assert.equal(Boolean(report.input.sourceIdentity.reviewedBindingIr), reviewed);
		assert.equal(report.input.sourceIdentity.modules.length, 1);
		assert.equal(report.input.sourceIdentity.modules[0].source.sha256, sha256(await readFile(`tests/fixtures/onboarding/${fixture}/Owned.lean`)));
		const native = ownedJvmConversionNative(report.input);
		assert.equal(report.cSourceSha256, sha256(native.implementation));
		assert.equal(report.guardSha256, sha256(native.cleanup.guardSource));
		const model = generateOwnedJvmConversions(native.c.layout.model.bindingIr);
		assert.deepEqual(report.files, Object.fromEntries(Object.entries(model.files).map(([path, source]) => [path, sha256(source)])));
		const runtime = Object.entries(model.files).find(([path]) => path.endsWith("/_OwnedRuntime.java"))[1];
		assert.equal(report.instrumentedRuntimeSha256, sha256(runtime.replace("static void checkpoint() { }", "static void checkpoint() { OwnedConversionProbe.allocation(); }")));
		const exercise = await readFile(`tests/fixtures/structured-types/owned-jvm-${scalar ? "scalars" : "compositions"}.java`, "utf8");
		assert.equal(report.probeSha256, sha256(ownedJvmConversionProbeSource(model, template, exercise)));
		const expected = scalar ? { checks: 300, managedFailures: 55, nativeFailures: 23, live: 0, identities: 0 }
			: { checks: 786, managedFailures: 222, nativeFailures: 115, live: 0, identities: 0 };
		assert.deepEqual(Object.fromEntries(Object.keys(expected).map(key => [key, report[key]])), expected);
		assert.ok(record.run.text.includes("# " + JSON.stringify(expected)));
	}
	await assertOwnedJvmRuntime(JSON.parse(previousBytes.toString("utf8")));
};
