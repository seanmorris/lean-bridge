/**
 * Guards runtime identity checks, host-warning handling, and consumer failure diagnostics.
 *
 * @file
 */

import assert from "node:assert/strict";
import test from "node:test";

import { componentScalarAbi } from "../src/abi/component-scalars.mjs";
import { assertConsumerJsonResult, assertConsumerRuntimeIdentity, runConsumerCommand } from "../src/adoption/consumer-checks.mjs";

const warning = "(node:123) ExperimentalWarning: Importing JSON modules is an experimental feature and might change at any time\n";
const hint = "(Use `node --trace-warnings ...` to show where the warning was created)\n";
const observation = overrides => ({
	label: "Documentation example"
	, status: 0
	, stdout: '{"callback":42,"identity":true}\n'
	, stderr: ""
	, expected: { identity: true, callback: 42 }, ...overrides
});

test("consumer JSON compares decoded values and accepts an otherwise clean known Node warning", () => {
	for(const stderr of ["", warning, warning + hint, (warning + hint).replaceAll("\n", "\r\n")])
	{
		assert.deepEqual(assertConsumerJsonResult(observation({ stderr, allowNodeJsonImportWarning: true })), { callback: 42, identity: true });
	}
});

test("host warning exceptions are opt-in and reject every unrecognized stderr byte", () => {
	assert.throws(() => assertConsumerJsonResult(observation({ stderr: warning })), /Documentation example failed/);
	for(const stderr of [
		"PHP Fatal error: invalid handle\n"
		, hint
		, warning + "real error\n"
		, "real error\n" + warning + hint
		, warning.replace("JSON modules", "another API")
		, warning + hint + " "
		, warning + hint + "\n"
	]){
		assert.throws(() => assertConsumerJsonResult(observation({ stderr, allowNodeJsonImportWarning: true })), /Documentation example failed/);
	}
});

test("valid warnings cannot hide exits, signals, malformed JSON, or wrong values", () => {
	for(const overrides of [
		{ status: 1 }
		, { status: "ENOENT" }
		, { status: null }
		, { signal: "SIGTERM" }
		, { stdout: "not JSON" }
		, { stdout: "" }
		, { stdout: '{"callback":43,"identity":true}' }
		, { stdout: '{"callback":"42","identity":true}' }
	]){
		assert.throws(() => assertConsumerJsonResult(observation({ stderr: warning + hint, allowNodeJsonImportWarning: true, ...overrides })), /Documentation example failed/);
	}
});

test("consumer JSON failures report both streams, exit status, and expected and actual values", () => {
	assert.throws(() => assertConsumerJsonResult(observation({
		status: 7
		, stderr: warning + hint
		, stdout: '{"callback":43,"identity":true}'
		, allowNodeJsonImportWarning: true
	})), error => {
		const details = JSON.parse(error.message.slice(error.message.indexOf("\n") + 1));
		assert.equal(details.status, 7);
		assert.equal(details.stderr, warning + hint);
		assert.equal(details.stdout, '{"callback":43,"identity":true}');
		assert.equal(details.expected.callback, 42);
		assert.equal(details.actual.callback, 43);
		return true;
	});
});

test("consumer subprocess diagnostics retain output that execFile's default error omits", async () => {
	await assert.rejects(runConsumerCommand(process.execPath, ["-e", 'process.stdout.write("structured build failure"); process.stderr.write("separate warning"); process.exitCode=7;']), error => {
		assert.equal(error.code, 7);
		assert.equal(error.stdout, "structured build failure");
		assert.equal(error.stderr, "separate warning");
		assert.match(error.message, /"status": 7/);
		assert.match(error.message, /structured build failure/);
		assert.match(error.message, /separate warning/);
		return true;
	});
	const success = await runConsumerCommand(process.execPath, ["-e", 'process.stdout.write("ok")']);
	assert.equal(success.status, 0);
	assert.equal(success.stdout, "ok");
});

test("consumer subprocess failures keep bounded tails and identify spawn failures", async () => {
	await assert.rejects(runConsumerCommand(process.execPath, ["-e", 'process.stdout.write("x".repeat(40000)+"end"); process.exitCode=1;']), error => {
		assert.equal(error.stdout.length, 16 * 1024);
		assert.ok(error.stdout.endsWith("end"));
		return true;
	});
	await assert.rejects(runConsumerCommand("/does-not-exist/lean-bridge-consumer", []), error => error.code === "ENOENT" && /ENOENT/.test(error.message));
});

const installed = () => {
	const runtimeIdentity = "a".repeat(64);
	const version = `0.0.0-abi${componentScalarAbi}.${runtimeIdentity}`;
	const runtime = `@lean-bridge/runtime@${version}`;
	return {
		verification: { verified: true, runtime, component: "example@1.0.0", package: "example@1.0.0" }
		, receipt: { component: { id: "example@1.0.0" }, runtime: { package: runtime }, package: { package: "example@1.0.0" } }
		, runtimePackage: { name: "@lean-bridge/runtime", version, leanBridge: { componentScalarAbi, runtimeIdentity, abiVersion: 1 } }
		, componentPackage: { name: "example", version: "1.0.0", dependencies: { "@lean-bridge/runtime": version } }
	};
};

test("installed runtime identity uses the scalar ABI, not the separate graph ABI", () => {
	assert.doesNotThrow(() => assertConsumerRuntimeIdentity(installed()));
});

test("installed-consumer checks reject ABI, hash, receipt, dependency, and package drift", () => {
	const mutations = [
		value => { value.verification.verified = false; }
		, value => { value.runtimePackage.leanBridge.componentScalarAbi = componentScalarAbi - 1; }
		, value => { value.runtimePackage.version = value.runtimePackage.version.replace(`abi${componentScalarAbi}`, `abi${componentScalarAbi - 1}`); }
		, value => { value.runtimePackage.leanBridge.runtimeIdentity = "b".repeat(64); }
		, value => { value.runtimePackage.leanBridge.runtimeIdentity = "a".repeat(12); }
		, value => { value.verification.runtime += "changed"; }
		, value => { value.receipt.runtime.package += "changed"; }
		, value => { value.componentPackage.dependencies["@lean-bridge/runtime"] = "*"; }
		, value => { value.componentPackage.version = "2.0.0"; }
		, value => { value.receipt.package.package = "other@1.0.0"; }
		, value => { value.receipt.component.id = "other@1.0.0"; }
	];
	for(const mutate of mutations)
	{
		const value = installed();
		mutate(value);
		assert.throws(() => assertConsumerRuntimeIdentity(value));
	}
});
