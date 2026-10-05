/**
 * Verify the executed generated-API scope without claiming installed packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sha256 } from "../../src/capsule/node.mjs";
import { assertOwnedJavaScriptWasmCi, ownedJavaScriptWasmTestCommand } from "./owned-javascript-wasm-ci.mjs";

export const ownedJavaScriptWasmScope = Object.freeze({
	target: "wasm32", privateAbi: 10
	, sourcePaths: ["ordinary-source", "reviewed-ir"]
	, generatedPublicApi: true, strictTypeScript: true, sharedRuntime: true
	, productionProfiles: ["startup", "lazy", "final-static"]
	, primitiveCallbacks: 19, synchronousCallbacks: true
	, installedCli: false, installedNpm: false, installedBrowser: false
	, transferredInputs: false, anchoredResults: false, promotedCells: 0
});
export const ownedJavaScriptWasmEvidenceCommands = Object.freeze({
	execution: "LEAN_BRIDGE_OWNED_JS_WASM_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_TEST=1 LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT=/app/build/lean-link-spike-owned-20260928 EMCC_CORES=2 " + ownedJavaScriptWasmTestCommand
	, ci: "node --test tests/owned-javascript-wasm-ci.test.mjs tests/owned-php-wasm-ci.test.mjs"
});
export const ownedJavaScriptWasmScalarRepairCommand = "node --test --test-name-pattern='malformed scalar replies' tests/component-runtime.test.mjs";

/**
 * Bind successful execution to enabled compilers, retained observations and CI.
 * Exact-source checks live in the companion source-history test.
 *
 * @param record - Frozen source-bound generated JavaScript execution receipt.
 */
export const assertOwnedJavaScriptWasmExecution = async record => {
	assert.equal(record.acceptance, "passed");
	assert.deepEqual(record.scope, ownedJavaScriptWasmScope);
	assert.deepEqual(Object.keys(record.scalarReplyRepair).sort(), ["after", "before"]);
	for(const [name, failed] of [["before", true], ["after", false]])
	{
		const run = record.scalarReplyRepair[name];
		assert.equal(run.command, ownedJavaScriptWasmScalarRepairCommand);
		assert.equal(run.exitCode, failed ? 1 : 0);
		assert.equal(sha256(run.text), run.sha256);
		for(const [key, value] of Object.entries({ tests: 1, pass: failed ? 0 : 1, fail: failed ? 1 : 0, skipped: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
		assert.match(run.text, /malformed scalar replies cannot pass forged ownership bits to native cleanup/u);
	}
	assert.deepEqual(Object.keys(record.runs).sort(), Object.keys(ownedJavaScriptWasmEvidenceCommands).sort());
	for(const [name, count] of [["execution", 136], ["ci", 4]])
	{
		const run = record.runs[name]; assert.equal(run.command, ownedJavaScriptWasmEvidenceCommands[name]);
		assert.equal(run.exitCode, 0); assert.equal(sha256(run.text), run.sha256);
		for(const [key, value] of Object.entries({ tests: count, pass: count, fail: 0, cancelled: 0, skipped: 0, todo: 0 }))
			assert.match(run.text, new RegExp("^# " + key + " " + value + "$", "mu"));
		assert.doesNotMatch(run.text, /^not ok|# SKIP|# TODO/mu);
		const cases = [...run.text.matchAll(/^ok (\d+) - ([^\n]+)$/gmu)];
		assert.deepEqual(cases.map(match => Number(match[1])), Array.from({ length: count }, (_, index) => index + 1));
		assert.equal(new Set(cases.map(match => match[2])).size, count);
		assert.equal([...run.text.matchAll(/^# Subtest: /gmu)].length, count);
	}
	const observations = [...record.runs.execution.text.matchAll(/^# (\{[^\n]+)\n/gmu)].map(match => JSON.parse(match[1]));
	assert.equal(observations.length, 9);
	assert.deepEqual(observations.slice(0, 2), ["ordinary", "reviewed"].map(source => ({
		source, primitiveCallbacks: 19, reentries: 63
		, nativeFaults: 47, hostFaults: 13
		, live: [0, 0, 0, 0], initializations: 1
	})));
	assert.deepEqual(observations.slice(2, 5), ["startup", "lazy", "final-static"].map(profile => ({
		profile, coreInitializations: 1, libraryInitializations: 1
		, components: 0, identities: 0, legacyHandles: 0
	})));
	assert.deepEqual(observations.slice(5, 7), [false, true].map(reviewed => ({
		reviewed, coreInitializations: 1, libraryInitializations: 2
		, components: 0, identities: 0
	})));
	assert.deepEqual(observations.slice(7), [false, true].map(reviewed => ({
		reviewed, alphaFirst: reviewed, runtimeInitializations: 1
		, libraryInitializations: 2, state: reviewed ? 3 : 4
		, owners: 0, identities: 0, allocations: 0, legacyHandles: 0
	})));
	assertOwnedJavaScriptWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8"));
};
