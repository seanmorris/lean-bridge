/**
 * Require real compilation, installed consumers and bounded isolation claims.
 *
 * @file
 */
import assert from "node:assert/strict";
import { sha256 } from "../../src/capsule/node.mjs";

const sdk = "source scripts/env.sh\nLEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT=/app/build/lean-link-spike-owned-cancel-20260928 EMCC_CORES=2 ";
export const ownedJavaScriptEngineCommands = Object.freeze({
	engine: sdk + "node --test --test-concurrency=1 tests/javascript-wasm-toolchain.test.mjs tests/owned-javascript-archive-sdk.test.mjs tests/owned-javascript-engine-request.test.mjs tests/owned-javascript-engine.test.mjs tests/owned-javascript-isolated-project.test.mjs"
	, ci: "node --test --test-name-pattern='boundary|bootstrap|managed CI' tests/owned-javascript-wasm-shared.test.mjs tests/managed-ci-isolation.test.mjs"
	, reviewed: "node --test --test-name-pattern='every consumer target' tests/type-corpus-reviewed.test.mjs"
	, cli: sdk + "node --test tests/owned-javascript-cli.test.mjs"
	, runtime: "node --test --test-concurrency=1 tests/internal/abi/lean-pending-operation.test.mjs tests/performance-overhead.test.mjs"
});
export const ownedJavaScriptEngineScope = Object.freeze({
	realCompiler: true, archiveSdk: true, ordinaryAndReviewed: true
	, generatedLeanAndC: true, installedNode: true, sourceReadOnly: true
	, sourceOnlyRequestSchema: 4, injectedEngineTransport: true
	, nixIsolation: false, dockerIsolation: false, signedPublication: false
	, installedSupportPromotions: 0
});
const observations = text => [...text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));

/**
 * Check complete no-skip TAP output and the actual compiler/consumer observations.
 *
 * @param record - Source-bound engine integration receipt.
 */
export const assertOwnedJavaScriptEngineExecution = record => {
	assert.equal(record.acceptance, "passed"); assert.deepEqual(record.scope, ownedJavaScriptEngineScope);
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedJavaScriptEngineCommands).sort());
	for(const [name, tests] of [["engine", 16], ["ci", 4], ["reviewed", 2], ["cli", 3], ["runtime", 8]])
	{
		const run = record.runs[name]; assert.equal(run.command, ownedJavaScriptEngineCommands[name]);
		assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
		for(const [key, count] of Object.entries({ tests, pass: tests, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + count + "$", "mu"));
		assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
	}
	const reports = observations(record.runs.engine.text); assert.equal(reports.length, 7);
	for(const reviewed of [false, true])
	{
		const archive = reports.find(item => item.reviewed === reviewed && item.sdkGitQueries === 0);
		assert.ok(archive); assert.equal(archive.exports, 51);
		assert.equal(archive.sourceUnchanged, true); assert.equal(archive.installedNode, true);
		assert.equal(archive.producerRemoved, true); assert.equal(archive.nixIsolation, false);
		assert.match(archive.compiler, /6\.0\.6 \(ce75e06884093bcefb86a6b8fd56a5d62a4cc245\)/u);
		assert.deepEqual(archive.releaseArchive, { schemaVersion: 1
			, kind: "emscripten-release-archive"
			, version: "6.0.6", release: "833aa203ba2283fc2b6adb504a79a3a0d692df81"
			, sha256: "sha256-bLfPRa2FsLm0ZqRMxLtl7zgOR/BAznPm+Va954J4f0Y=" });
		assert.deepEqual(reports.find(item => item.reviewed === reviewed && item.sourceOnlyRequest), {
			reviewed, exports: 51, sourceUnchanged: true, inputUnchanged: true
			, sourceOnlyRequest: true, checkedOutput: true
			, rejectedMutations: 6, nixIsolation: false
		});
		assert.deepEqual(reports.find(item => item.reviewed === reviewed && item.engineInvocations), {
			reviewed, engineInvocations: 1, ignoredHostSdk: true, installedNode: true
			, producerRemoved: true, requestSchema: 4
			, injectedTransport: true, nixIsolation: false
		});
	}
	assert.deepEqual(reports.find(item => item.generated), {
		generated: true, nativeInputs: true, lockedDependencies: true
		, sourceUnchanged: true
		, installedNode: true, producerRemoved: true, generatedResult: 32
		, exports: 3, nixIsolation: false
	});
	const cli = observations(record.runs.cli.text); assert.equal(cli.length, 1);
	assert.match(cli[0].compilerInputsIdentity, /^[a-f0-9]{64}$/u);
	assert.deepEqual(cli[0].reports, [false, true].map(reviewed => ({
		reviewed, component: "@owned/" + (reviewed ? "reviewed" : "ordinary")
		, sourceRemoved: true, installedCli: true, installedConsumer: true
		, combinedNative: reviewed
	})));
	assert.match(record.runs.runtime.text, /native cancellation unlinks any pending slot before synchronous shutdown/u);
	assert.match(record.runs.runtime.text, /native overhead suite measures generated calls and releases every value/u);
};
