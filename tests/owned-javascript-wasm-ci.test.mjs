/**
 * Keep the JS ownership execution job enabled, observable and required.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertOwnedJavaScriptWasmCi, ownedJavaScriptWasmCiLogs, ownedJavaScriptWasmCiTests, ownedJavaScriptNpmCiTests, ownedJavaScriptCoexistenceCiTests, ownedAnalysisCiTests } from "./helpers/owned-javascript-wasm-ci.mjs";

test("owned JavaScript CI builds production Wasm and executes every generated API layer", async () => {
	assert.deepEqual(assertOwnedJavaScriptWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8")), {
		testFiles: 17, installedTestFiles: 4, coexistenceTestFiles: 2
		, analysisTestFiles: 2, requiredLogs: 5
		, productionRuntimeRequired: true
		, skippedTestsRejected: true, failurePropagated: true
	});
});

test("owned JavaScript CI rejects disabled execution, missing observations and swallowed failures", async () => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const mutations = [
		...ownedJavaScriptWasmCiTests.map(path => [path, ""])
		, ...ownedJavaScriptNpmCiTests.map(path => [path, ""])
		, ...ownedJavaScriptCoexistenceCiTests.map(path => [path, ""])
		, ...ownedAnalysisCiTests.map(path => [path, ""])
		, ...ownedJavaScriptWasmCiLogs.map(path => ["            " + path + "\n", ""])
		, ["  owned-javascript-wasm:\n", "  owned-javascript-wasm:\n    if: false\n"]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST: \"0\""]
		, ["      LEAN_BRIDGE_COMPILER_ANALYSIS_TEST: \"1\"", "      LEAN_BRIDGE_COMPILER_ANALYSIS_TEST: \"0\""]
		, ["      - name: Compare ownership analysis with compiled APIs\n", "      - name: Compare ownership analysis with compiled APIs\n        if: false\n"]
		, ["tee build/owned-javascript-wasm/analysis.log\n", "tee build/owned-javascript-wasm/analysis.log || true\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/analysis.log\n", ""]
		, ["      - name: Install owned npm browser engines\n", "      - name: Install owned npm browser engines\n        if: false\n"]
		, ["      - name: Build and install owned npm packages through the standalone CLI\n", "      - name: Build and install owned npm packages through the standalone CLI\n        continue-on-error: true\n"]
		, ["tee build/owned-javascript-wasm/installed.log\n", "tee build/owned-javascript-wasm/installed.log || true\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/installed.log\n", ""]
		, ["      - name: Verify installed copied and owned npm coexistence\n", "      - name: Verify installed copied and owned npm coexistence\n        if: false\n"]
		, ["tee build/owned-javascript-wasm/coexistence.log\n", "tee build/owned-javascript-wasm/coexistence.log || true\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/coexistence.log\n", ""]
		, ["      - name: Execute owned JavaScript values and generated public APIs\n", "      - name: Execute owned JavaScript values and generated public APIs\n        if: false\n"]
		, ["      - name: Execute owned JavaScript values and generated public APIs\n", "      - name: Execute owned JavaScript values and generated public APIs\n        continue-on-error: true\n"]
		, ["          set -euo pipefail\n", ""]
		, ["bash scripts/build-lean-link-spike.sh 2>&1", "true 2>&1"]
		, ["tee build/owned-javascript-wasm/execution.log\n", "tee build/owned-javascript-wasm/execution.log || true\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/execution.log\n", ""]
		, ["          test -s build/lean-link-spike/lazy/main.wasm\n", ""]
		, ["      - owned-javascript-wasm\n", ""]
		, ["if: needs.owned-javascript-wasm.result != 'success'", "if: false"]
	];
	for(const [before, after] of mutations)
	{
		const changed = source.replace(before, after); assert.notEqual(changed, source);
		assert.throws(() => assertOwnedJavaScriptWasmCi(changed), before);
	}
});
