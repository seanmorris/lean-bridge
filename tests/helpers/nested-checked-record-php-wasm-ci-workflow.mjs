/**
 * Keep all four installed PHP-Wasm routes mandatory, with pinned tools and original records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

/**
 * Reject conditions, environment substitutions and shell commands that bypass acceptance.
 *
 * @param source - Complete nested-checked-record-php-wasm.yml source.
 */
export const assertNestedCheckedRecordPhpWasmWorkflow = source => {
	assert.ok(source.startsWith("name: Installed nested checked records in PHP-Wasm\n"));
	assert.ok(source.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nested-checked-record-php-wasm-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["push", "pull_request", "workflow_dispatch", "nested-checked-record-php-wasm"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 2);
	assert.ok(source.includes('    env:\n      EMCC_CORES: "2"\n      LEAN_WASM_RUNTIME_PROFILE: browser\n      LEAN_WASM_RUNTIME_VARIANT: php-wasm-3.1.68\n      LEAN_WASM_ARTIFACT_TARGET: php-wasm-emscripten-3.1.68\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Install Nix"
		, "Restore pinned PHP and compiler inputs"
		, "Install dependencies without lifecycle scripts"
		, "Bound apt network waits", "Install PHP and compiler dependencies"
		, "Disable host PHP debugging instrumentation", "Install Chromium"
		, "Build the pinned PHP-Wasm runtime and host"
		, "Require both source routes and both nested checked-record API modes"
		, "Preserve original and partial installed records"
		, "Enforce installed nested checked-record PHP-Wasm acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: cachix/install-nix-action@v31\n");
	assert.equal(step(names[3]), "        uses: actions/cache@v5\n        with:\n          path: |\n            .toolchains\n            build/php-wasm-sdk\n            build/php-wasm-host\n          key: nested-checked-record-php-wasm-${{ runner.os }}-${{ hashFiles('flake.lock', 'lean-toolchain', 'scripts/bootstrap-toolchains.sh', 'scripts/bootstrap-php-wasm-ci.sh', 'poc/lean-link-spike/bindings/php-wasm.package.json') }}\n");
	assert.equal(step(names[5]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[10]).startsWith("        id: acceptance\n        timeout-minutes: 45\n        env:\n          LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: build/nested-checked-record-php-wasm-input/php-wasm-runtime\n        shell: bash\n"));
	assert.equal(step(names[11]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nested-checked-record-php-wasm-${{ github.sha }}\n          path: |\n            build/nested-checked-record-php-wasm-ci/\n            build/nested-checked-record-php-wasm-host.log\n            build/nested-checked-record-php-wasm-runtime.log\n            build/nested-checked-record-php-wasm-input/php-wasm-runtime/runtime.json\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"npm ci --ignore-scripts --no-audit --no-fund"
		, "sudo apt-get update\nsudo apt-get install -y build-essential autoconf automake bison flex gperf libtool re2c cmake pkg-config php-cli php-dev php-common php-zip php-mbstring composer zstd ripgrep\nbash scripts/bootstrap-php-wasm-ci.sh --check-prerequisites"
		, "if /usr/bin/php -r 'exit(extension_loaded(\"xdebug\") ? 0 : 1);'; then\n  sudo phpdismod -s cli xdebug\nfi\nenv -i PATH=/usr/bin:/bin /usr/bin/php -r 'if (extension_loaded(\"xdebug\")) { fwrite(STDERR, \"Consumer PHP must run without Xdebug.\\n\"); exit(1); }'"
		, "bash scripts/install-playwright-browsers.sh chromium"
		, "set -euo pipefail\nmkdir -p build\nbash scripts/bootstrap-php-wasm-ci.sh 2>&1 | tee build/nested-checked-record-php-wasm-host.log\nbash scripts/bootstrap-toolchains.sh\nexport LEAN_WASM_EMSDK=\"$GITHUB_WORKSPACE/.toolchains/emsdk-php-wasm\"\nbash scripts/build-lean-runtime.sh 2>&1 | tee build/nested-checked-record-php-wasm-runtime.log\nsource scripts/env.sh\nnode --input-type=module -e 'import {prepareOwnedPhpWasmRuntime} from \"./tests/helpers/owned-php-wasm-runtime.mjs\"; await prepareOwnedPhpWasmRuntime(\"build/nested-checked-record-php-wasm-input\");'\ntest -s build/nested-checked-record-php-wasm-input/php-wasm-runtime/runtime.json"
		, "set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-nested-checked-record-php-wasm-ci.sh"
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
