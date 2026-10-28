/**
 * Refuse workflow changes that weaken PHP-Wasm installed acceptance.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalSubtypePhpWasmWorkflow } from "./nominal-subtype-php-wasm-ci-workflow.mjs";

test("nominal PHP-Wasm workflow requires pinned inputs and all four selections", async () => {
	const source = await readFile(".github/workflows/nominal-subtype-php-wasm.yml", "utf8");
	assertNominalSubtypePhpWasmWorkflow(source);
	const shell = await readFile("scripts/run-nominal-subtype-php-wasm-ci.sh", "utf8");
	for(const command of [
		"for route in ordinary reviewed; do"
		, "for mode in full result-only; do"
		, "export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_TEST=1"
		, "export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1"
		, "node scripts/snapshot-nominal-subtype-php-wasm-ci.mjs"
		, "node scripts/check-nominal-subtype-php-wasm-ci.mjs"
		, 'cmp "$output/runtime-before.json" "$output/runtime-after.json"'
		, "git diff --quiet HEAD --"
	]) assert.ok(shell.includes(command), command);
	assert.ok(shell.indexOf('mkdir "$output_root"') < shell.indexOf("export LEAN_BRIDGE_NOMINAL_SUBTYPE_PHP_WASM_TEST=1"));
});

test("nominal PHP-Wasm workflow controls refuse skipped acceptance, altered tools and narrowed records", async t => {
	const source = await readFile(".github/workflows/nominal-subtype-php-wasm.yml", "utf8");
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
		, ["test -s build/nominal-subtype-php-wasm-input/php-wasm-runtime/runtime.json", "true missing-runtime-receipt"]
		, ["LEAN_WASM_RUNTIME_VARIANT: php-wasm-3.1.68", "LEAN_WASM_RUNTIME_VARIANT: wrong"]
		, ["LEAN_WASM_ARTIFACT_TARGET: php-wasm-emscripten-3.1.68", "LEAN_WASM_ARTIFACT_TARGET: wrong"]
		, ["$GITHUB_WORKSPACE/.toolchains/emsdk-php-wasm", "/ambient/compiler"]
		, ["LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: build/nominal-subtype-php-wasm-input/php-wasm-runtime", "LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: /ambient/runtime"]
		, ["        id: acceptance\n", "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        continue-on-error: true\n"]
		, ["bash scripts/run-nominal-subtype-php-wasm-ci.sh", "bash scripts/run-nominal-subtype-php-wasm-ci.sh || true"]
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/nominal-subtype-php-wasm-ci/\n", "build/nominal-subtype-php-wasm-ci/ordinary-source/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 180", "timeout-minutes: 360"]
		, ["        id: acceptance\n        timeout-minutes: 100\n", "        id: acceptance\n        timeout-minutes: 1\n"]
		, ["LEAN_BRIDGE_SIGNATURE_SPECIALIZATION_PHP_WASM_TEST=1", "LEAN_BRIDGE_SIGNATURE_SPECIALIZATION_PHP_WASM_TEST=0"]
		, ["--test-name-pattern='^installed ordinary and reviewed PHP-Wasm packages execute selected instances in every loading arrangement$'", "--test-name-pattern='^installed ordinary'"]
		, ["test -s build/nominal-subtype-php-wasm-ci/signature-specializations.json", "true missing-signature-report"]
		, ["    tests/reviewed-specializations.test.mjs\n", "    tests/reviewed-specializations.test.mjs || true\n"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source); assert.throws(() => assertNominalSubtypePhpWasmWorkflow(changed), before);
	}
	t.diagnostic(`${replacements.length} workflow bypasses refused`);
});
