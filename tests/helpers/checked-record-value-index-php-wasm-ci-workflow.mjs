/**
 * Assert the dedicated hosted value-index PHP-Wasm acceptance workflow.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Require pinned build inputs, all four installed routes, and fatal acceptance.
 *
 * @param source - Complete GitHub workflow source.
 */
export const assertCheckedRecordValueIndexPhpWasmWorkflow = source => {
	assert.equal(typeof source, "string");
	assert.ok(source.startsWith("name: Installed value-index checked records in PHP-Wasm\n"));
	for(const required of [
		"on:\n  workflow_dispatch:\n"
		, "contents: read"
		, "group: checked-record-value-index-php-wasm-${{ github.ref }}"
		, "cancel-in-progress: true"
		, "runs-on: ubuntu-24.04"
		, "timeout-minutes: 180"
		, "fetch-depth: 0"
		, "persist-credentials: false"
		, 'node-version: "22"'
		, "npm ci --ignore-scripts"
		, "uses: cachix/install-nix-action@v31"
		, "bash scripts/bootstrap-php-wasm-ci.sh --check-prerequisites"
		, "bash scripts/install-playwright-browsers.sh chromium"
		, "LEAN_WASM_RUNTIME_VARIANT: php-wasm-3.1.68"
		, "LEAN_WASM_ARTIFACT_TARGET: php-wasm-emscripten-3.1.68"
		, "bash scripts/build-lean-runtime.sh"
		, "prepareOwnedPhpWasmRuntime(\"build/checked-record-value-index-php-wasm-input\")"
		, "test -s build/checked-record-value-index-php-wasm-input/php-wasm-runtime/runtime.json"
		, "LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: build/checked-record-value-index-php-wasm-input/php-wasm-runtime"
		, "bash scripts/run-checked-record-value-index-php-wasm-ci.sh"
		, "build/checked-record-value-index-php-wasm-ci/"
		, "if-no-files-found: error"
		, "if: always() && steps.acceptance.outcome != 'success'"
		, "run: exit 1"
	]) assert.ok(source.includes(required), required);
	assert.doesNotMatch(source, /continue-on-error:|set \+e|\|\| true/u);
};
