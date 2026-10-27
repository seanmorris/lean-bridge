/**
 * Refuse workflow changes that weaken PHP-Wasm installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertCheckedRecordPhpWasmWorkflow } from "./checked-record-php-wasm-ci-workflow.mjs";

test("the dedicated PHP-Wasm checked-record workflow requires pinned inputs and all four routes", async () => {
	const source = await readFile(".github/workflows/checked-record-php-wasm.yml", "utf8");
	assertCheckedRecordPhpWasmWorkflow(source);
	const shell = await readFile("scripts/run-checked-record-php-wasm-ci.sh", "utf8");
	assert.ok(shell.includes("for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do"));
	assert.ok(shell.includes("export LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_TEST=1"));
	assert.ok(shell.includes("export LEAN_BRIDGE_CHECKED_RECORD_PHP_WASM_LEAN_TEST=1"));
	assert.ok(shell.includes("node scripts/check-checked-record-php-wasm-compiler-ci.mjs"));
	assert.ok(shell.includes("node scripts/check-checked-record-php-wasm-ci.mjs"));
});

test("PHP-Wasm workflow controls refuse skipped acceptance, altered tools and narrowed records", async t => {
	const source = await readFile(".github/workflows/checked-record-php-wasm.yml", "utf8");
	const replacements = [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["bash scripts/bootstrap-toolchains.sh", "true missing-tools"]
		, ["bash scripts/install-playwright-browsers.sh chromium", "true missing-browser"]
		, ["bash scripts/bootstrap-php-wasm-ci.sh 2>&1", "true missing-host 2>&1"]
		, ["bash scripts/build-lean-runtime.sh", "true missing-runtime"]
		, ["test -s build/checked-record-php-wasm-input/php-wasm-runtime/runtime.json", "true missing-runtime-receipt"]
		, ["LEAN_WASM_RUNTIME_VARIANT: php-wasm-3.1.68", "LEAN_WASM_RUNTIME_VARIANT: wrong"]
		, ["LEAN_WASM_ARTIFACT_TARGET: php-wasm-emscripten-3.1.68", "LEAN_WASM_ARTIFACT_TARGET: wrong"]
		, ["$GITHUB_WORKSPACE/.toolchains/emsdk-php-wasm", "/ambient/compiler"]
		, ["LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: build/checked-record-php-wasm-input/php-wasm-runtime", "LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: /ambient/runtime"]
		, ["        id: acceptance\n", "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        continue-on-error: true\n"]
		, ["bash scripts/run-checked-record-php-wasm-ci.sh", "bash scripts/run-checked-record-php-wasm-ci.sh || true"]
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/checked-record-php-wasm-ci/\n", "build/checked-record-php-wasm-ci/ordinary-source/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source); assert.throws(() => assertCheckedRecordPhpWasmWorkflow(changed), before);
	}
	t.diagnostic(`${replacements.length} workflow bypasses refused`);
});
