/**
 * Keep the JS ownership execution job enabled, observable and required.
 *
 * @file
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { assertOwnedJavaScriptWasmCi, ownedJavaScriptWasmCiLogs, ownedJavaScriptWasmCiTests, ownedJavaScriptNpmCiTests, ownedJavaScriptCoexistenceCiTests, ownedAnalysisCiTests, ownedJavaScriptEngineCiTests, ownedJavaScriptPublicationCiTests, ownedCheckedRecordJavaScriptAcceptanceLog } from "./helpers/owned-javascript-wasm-ci.mjs";

test("owned checked-record npm runtime defaults follow the checkout and honor overrides", async () => {
	const source = await readFile("tests/owned-checked-record-javascript-packaging.test.mjs", "utf8");
	const definitions = source.slice(source.indexOf("const target = ")
		, source.indexOf("const packagingRoot = "));
	assert.ok(definitions.startsWith("const target = "));
	const checkout = "/home/runner/work/lean-bridge/lean-bridge";
	const evaluate = env => JSON.parse(runInNewContext(
		definitions + "\nJSON.stringify({target, prepared});", {
			process: { env }, resolve: (...parts) => resolve(checkout, ...parts)
		}, { timeout: 1000 }));
	const runtime = "build/lean-runtime/f3b06c705e6c85f5314019d5d3baab0fec5b580c-743765bf566f43ec2f7b4eb84a85686880b3797efe83bf244d6fc7281e4f85a3-browser";
	assert.deepEqual(evaluate({}), {
		target: resolve(checkout, runtime)
		, prepared: resolve(checkout, "build/lean-link-spike/lazy")
	});
	assert.deepEqual(evaluate({
		LEAN_BRIDGE_JS_TARGET_RUNTIME: "/custom/runtime"
		, LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_ROOT: "/custom/prepared"
	}), { target: "/custom/runtime", prepared: "/custom/prepared/lazy" });
});

test("owned checked-record npm CI retains TAP across output reset and preserves failures", async t => {
	const source = await readFile(".github/workflows/consumer-matrix.yml", "utf8");
	const marker = "          test -s build/owned-subtype-javascript-packaging/report.json\n";
	const capture = source.split(marker)[1]?.split(
		"          test -s " + ownedCheckedRecordJavaScriptAcceptanceLog + "\n"
	)[0]?.replace(/^ {10}/gmu, "");
	assert.ok(capture?.includes("tests/owned-checked-record-javascript-packaging.test.mjs"));
	const scenarios = [
		{ status: 0, existing: false }, { status: 0, existing: true }
		, { status: 23, existing: false }, { status: 23, existing: true }
	];
	for(const { status, existing } of scenarios)
	{
		const root = await mkdtemp(join(tmpdir(), "lean-owned-record-log-"));
		t.after(() => rm(root, { recursive: true, force: true }));
		await mkdir(join(root, "build/owned-javascript-wasm"), { recursive: true });
		if(existing) await mkdir(join(root, "build/owned-checked-record-javascript-packaging"));
		// Model the installed test's before hook without building any packages.
		const stub = [
			"set -euo pipefail", "node() {"
			, "  if [[ -d build/owned-checked-record-javascript-packaging ]]; then"
			, "    rm -r -- build/owned-checked-record-javascript-packaging"
			, "  fi"
			, "  printf '%s\\n' 'TAP version 13' 'fixture output'"
			, "  printf '%s\\n' 'fixture diagnostic' >&2"
			, `  return ${status}`, "}", capture, "printf '%s\\n' continued"
		].join("\n");
		const result = spawnSync("bash", ["-c", stub], {
			cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 64 * 1024
		});
		assert.equal(result.error, undefined);
		assert.equal(result.status, status, result.stderr);
		assert.equal(await readFile(join(root, ownedCheckedRecordJavaScriptAcceptanceLog), "utf8")
			, "TAP version 13\nfixture output\nfixture diagnostic\n");
		assert.equal(result.stdout.includes("continued"), status === 0);
	}
});

test("owned JavaScript CI builds production Wasm and executes every generated API layer", async () => {
	assert.deepEqual(assertOwnedJavaScriptWasmCi(await readFile(".github/workflows/consumer-matrix.yml", "utf8")), {
		testFiles: 17, installedTestFiles: 6, coexistenceTestFiles: 2
		, analysisTestFiles: 2, engineTestFiles: 5
		, publicationTestFiles: 1, requiredLogs: 7
		, requiredInstalledReports: 2
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
		, ...ownedJavaScriptEngineCiTests.map(path => [path, ""])
		, ...ownedJavaScriptPublicationCiTests.map(path => [path, ""])
		, ["tests/owned-checked-record-javascript-packaging.test.mjs", ""]
		, ...ownedJavaScriptWasmCiLogs.map(path => ["            " + path + "\n", ""])
		, ["            build/owned-subtype-javascript-packaging/\n", ""]
		, ["          test -s build/owned-subtype-javascript-packaging/retained-packages.json\n", ""]
		, ["          node scripts/check-owned-subtype-javascript-ci.mjs \\\n", ""]
		, ["            build/owned-checked-record-javascript-packaging/\n", ""]
		, ['tee "$checked_record_log" || checked_record_status=$?'
			, 'tee "$checked_record_log" || true']
		, ["          mkdir -p build/owned-checked-record-javascript-packaging\n", ""]
		, ['          mv "$checked_record_log" ' + ownedCheckedRecordJavaScriptAcceptanceLog + "\n", ""]
		, ['          if (( checked_record_status != 0 )); then exit "$checked_record_status"; fi\n', ""]
		, ["  owned-javascript-wasm:\n", "  owned-javascript-wasm:\n    if: false\n"]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_PREPARED_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_BUILD_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_JS_WASM_BROWSER_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_SUBTYPE_JS_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_SUBTYPE_JS_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_SUBTYPE_BROWSER_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_SUBTYPE_BROWSER_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_CHECKED_RECORD_JS_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_CHECKED_RECORD_JS_TEST: \"0\""]
		, ["      LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST: \"1\"", "      LEAN_BRIDGE_OWNED_CHECKED_RECORD_BROWSER_TEST: \"0\""]
		, ["      LEAN_BRIDGE_COMPILER_ANALYSIS_TEST: \"1\"", "      LEAN_BRIDGE_COMPILER_ANALYSIS_TEST: \"0\""]
		, ["      - name: Compare ownership analysis with compiled APIs\n", "      - name: Compare ownership analysis with compiled APIs\n        if: false\n"]
		, ["tee build/owned-javascript-wasm/analysis.log\n", "tee build/owned-javascript-wasm/analysis.log || true\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/analysis.log\n", ""]
		, ["      - name: Verify owned JavaScript engine and archive SDK contracts\n", "      - name: Verify owned JavaScript engine and archive SDK contracts\n        if: false\n"]
		, ["tee build/owned-javascript-wasm/engine.log\n", "tee build/owned-javascript-wasm/engine.log || true\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/engine.log\n", ""]
		, ["      - name: Verify reproducible signed owned npm publication\n", "      - name: Verify reproducible signed owned npm publication\n        if: false\n"]
		, ["tee build/owned-javascript-wasm/publication.log\n", "tee build/owned-javascript-wasm/publication.log || true\n"]
		, ["          rg '^# skipped 0$' build/owned-javascript-wasm/publication.log\n", ""]
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
