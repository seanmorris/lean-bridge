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
 * @param source - Complete nominal-subtype-php-wasm.yml source.
 */
export const assertNominalSubtypePhpWasmWorkflow = source => {
	assert.ok(source.startsWith("name: Installed nominal Subtypes in PHP-Wasm\n"));
	assert.ok(source.includes("on:\n  workflow_call:\n    inputs:\n"));
	for(const input of ["optional_parameters", "direct_proof_erasure"])
		assert.match(source, new RegExp(
			`^ {6}${input}:\\n {8}description: .+\\n {8}required: false\\n {8}type: boolean\\n {8}default: false$`, "mu"));
	assert.ok(source.includes("  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nominal-subtype-php-wasm-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["workflow_call", "workflow_dispatch", "schedule", "nominal-subtype-php-wasm"]);
	assert.doesNotMatch(source, /^ {4}(?:continue-on-error|needs|strategy|defaults):/gmu);
	assert.equal(source.match(/^ {8}continue-on-error: true$/gmu)?.length, 2);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), [
		"        if: always()"
		, "        if: inputs.optional_parameters"
		, "        if: always() && inputs.optional_parameters"
		, "        if: always() && inputs.optional_parameters && steps.optional_parameters.outcome != 'success'"
		, "        if: inputs.direct_proof_erasure"
		, "        if: always() && inputs.direct_proof_erasure"
		, "        if: always() && inputs.direct_proof_erasure && steps.direct_proof_erasure.outcome != 'success'"
		, "        if: always() && steps.acceptance.outcome != 'success'"
	]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 4);
	assert.ok(source.includes('    env:\n      EMCC_CORES: "2"\n      LEAN_WASM_RUNTIME_PROFILE: browser\n      LEAN_WASM_RUNTIME_VARIANT: php-wasm-3.1.68\n      LEAN_WASM_ARTIFACT_TARGET: php-wasm-emscripten-3.1.68\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 360\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Install Nix"
		, "Restore pinned PHP and compiler inputs"
		, "Install dependencies without lifecycle scripts"
		, "Bound apt network waits", "Install PHP and compiler dependencies"
		, "Disable host PHP debugging instrumentation", "Install Chromium"
		, "Build the pinned PHP-Wasm runtime and host"
		, "Require ordinary, reviewed and both result-only installed packages"
		, "Preserve original and partial installed records"
		, "Execute optional parameters through native PHP and PHP-Wasm packages"
		, "Preserve optional-parameter PHP records"
		, "Enforce optional-parameter PHP acceptance"
		, "Qualify direct proof erasure in native PHP and PHP-Wasm packages"
		, "Upload direct proof-erasure PHP evidence"
		, "Enforce PHP support"
		, "Enforce installed PHP-Wasm acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: cachix/install-nix-action@v31\n");
	assert.equal(step(names[3]), "        uses: actions/cache@v5\n        with:\n          path: |\n            .toolchains\n            build/php-wasm-sdk\n            build/php-wasm-host\n          key: nominal-subtype-php-wasm-${{ runner.os }}-${{ hashFiles('flake.lock', 'lean-toolchain', 'scripts/bootstrap-toolchains.sh', 'scripts/bootstrap-php-wasm-ci.sh', 'poc/lean-link-spike/bindings/php-wasm.package.json') }}\n");
	assert.equal(step(names[5]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[10]).startsWith("        id: acceptance\n        timeout-minutes: 100\n        env:\n          LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME: build/nominal-subtype-php-wasm-input/php-wasm-runtime\n        shell: bash\n"));
	assert.equal(step(names[11]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nominal-subtype-php-wasm-${{ github.sha }}\n          path: |\n            build/nominal-subtype-php-wasm-ci/\n            build/nominal-subtype-php-wasm-host.log\n            build/nominal-subtype-php-wasm-runtime.log\n            build/nominal-subtype-php-wasm-input/php-wasm-runtime/runtime.json\n          if-no-files-found: error\n          retention-days: 30\n");
	assert.equal(step(names[12]), "        id: optional_parameters\n        if: inputs.optional_parameters\n        continue-on-error: true\n        timeout-minutes: 125\n        env:\n          LEAN_BRIDGE_PHP: /usr/bin/php\n          LEAN_BRIDGE_COMPOSER: /usr/bin/composer\n          LEAN_BRIDGE_PHP_EMSDK: ${{ github.workspace }}/.toolchains/emsdk-php-wasm\n        shell: bash\n        run: |\n          set -euo pipefail\n          source scripts/env.sh\n          export LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=\"$GITHUB_WORKSPACE/build/nominal-subtype-php-wasm-input/php-wasm-runtime\"\n          test -d \"$LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME\"\n          bash scripts/run-optional-parameter-php-ci.sh\n");
	assert.equal(step(names[13]), "        if: always() && inputs.optional_parameters\n        uses: actions/upload-artifact@v7\n        with:\n          name: optional-parameter-php-${{ github.sha }}\n          path: build/optional-parameter-php-ci/\n          if-no-files-found: error\n          overwrite: true\n          retention-days: 30\n");
	assert.match(step(names[15])
		, /^ {8}id: direct_proof_erasure\n {8}if: inputs\.direct_proof_erasure\n {8}continue-on-error: true/mu);
	assert.ok(step(names[15]).includes(
		"bash scripts/run-direct-proof-erasure-php-ci.sh"));
	assert.ok(step(names[16]).includes(
		"name: direct-proof-erasure-php-${{ github.sha }}"));
	assert.ok(step(names[16]).includes(
		"path: build/direct-proof-erasure-php-ci/"));
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"npm ci --ignore-scripts --no-audit --no-fund"
		, "sudo apt-get update\nsudo apt-get install -y build-essential autoconf automake bison flex gperf libtool re2c cmake pkg-config php-cli php-dev php-common php-zip php-mbstring composer zstd ripgrep\nbash scripts/bootstrap-php-wasm-ci.sh --check-prerequisites"
		, "if /usr/bin/php -r 'exit(extension_loaded(\"xdebug\") ? 0 : 1);'; then\n  sudo phpdismod -s cli xdebug\nfi\nenv -i PATH=/usr/bin:/bin /usr/bin/php -r 'if (extension_loaded(\"xdebug\")) { fwrite(STDERR, \"Consumer PHP must run without Xdebug.\\n\"); exit(1); }'"
		, "bash scripts/install-playwright-browsers.sh chromium"
		, "set -euo pipefail\nmkdir -p build\nbash scripts/bootstrap-php-wasm-ci.sh 2>&1 | tee build/nominal-subtype-php-wasm-host.log\nbash scripts/bootstrap-toolchains.sh\nexport LEAN_WASM_EMSDK=\"$GITHUB_WORKSPACE/.toolchains/emsdk-php-wasm\"\nbash scripts/build-lean-runtime.sh 2>&1 | tee build/nominal-subtype-php-wasm-runtime.log\nsource scripts/env.sh\nnode --input-type=module -e 'import {prepareOwnedPhpWasmRuntime} from \"./tests/helpers/owned-php-wasm-runtime.mjs\"; await prepareOwnedPhpWasmRuntime(\"build/nominal-subtype-php-wasm-input\");'\ntest -s build/nominal-subtype-php-wasm-input/php-wasm-runtime/runtime.json"
		, "set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-nominal-subtype-php-wasm-ci.sh\n"
			+ "LEAN_BRIDGE_SIGNATURE_SPECIALIZATION_PHP_WASM_TEST=1 \\\n"
			+ "LEAN_BRIDGE_SIGNATURE_SPECIALIZATION_PHP_WASM_REPORT=build/nominal-subtype-php-wasm-ci/signature-specializations.json \\\n"
			+ "  node --test --test-concurrency=1 \\\n"
			+ "    --test-name-pattern='^installed ordinary and reviewed PHP-Wasm packages execute selected instances in every loading arrangement$' \\\n"
			+ "    tests/reviewed-specializations.test.mjs\n"
			+ "test -s build/nominal-subtype-php-wasm-ci/signature-specializations.json"
		, "set -euo pipefail\nsource scripts/env.sh\nexport LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=\"$GITHUB_WORKSPACE/build/nominal-subtype-php-wasm-input/php-wasm-runtime\"\ntest -d \"$LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME\"\nbash scripts/run-optional-parameter-php-ci.sh"
		, "exit 1"
		, "set -euo pipefail\nsource scripts/env.sh\nexport LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME=\"$GITHUB_WORKSPACE/build/nominal-subtype-php-wasm-input/php-wasm-runtime\"\ntest -d \"$LEAN_BRIDGE_TEST_PHP_COPIED_RUNTIME\"\nbash scripts/run-direct-proof-erasure-php-ci.sh"
		, "exit 1"
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
