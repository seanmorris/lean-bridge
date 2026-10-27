/**
 * Require all four nested checked-record WIT selections on the pinned wasm-tools and Wasmtime C API in a dedicated workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { isolatedWasmtimeCapiBootstrap } from "./wasmtime-capi-bootstrap.mjs";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

const toolchains = "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\n"
	+ "bash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/nested-checked-record-wit-toolchain.log\n"
	+ "bash scripts/bootstrap-toolchains.sh --wasm-tools-only 2>&1 | tee -a build/nested-checked-record-wit-toolchain.log";
const capi = "set -euo pipefail\n" + isolatedWasmtimeCapiBootstrap.trimEnd();
const acceptance = "set -euo pipefail\nsource scripts/env.sh\n"
	+ "bash scripts/run-nested-checked-record-wit-ci.sh \"/usr/bin/cc\" \"$PWD/.toolchains/wasm-tools/bin/wasm-tools\" \"$PWD/build/wasmtime-c-api\"";
const indent = source => source.split("\n").map(line => "          " + line + "\n").join("");

/**
 * Check the dedicated workflow and exact executable commands.
 *
 * @param source - Complete nested-checked-record-wit.yml source.
 */
export const assertNestedCheckedRecordWitWorkflow = source => {
	assert.ok(source.startsWith("name: Installed nested checked records in WIT and WASI components\n"));
	assert.ok(source.includes("on:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nested-checked-record-wit-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["workflow_dispatch", "nested-checked-record-wit"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|set \+e|\|\| true/u);
	assert.doesNotMatch(source, /LEAN_BRIDGE_(?:NATIVE_TEST_GLIBC_FLOOR|NESTED_CHECKED_RECORD_WIT_|NOMINAL_SUBTYPE_WIT_|WASM_TOOLS|WASMTIME_C_API)|CC:/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes('    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies, the pinned Lean compiler and wasm-tools"
		, "Build the pinned Wasmtime C API"
		, "Require both source routes and API modes through Wasmtime"
		, "Preserve original and partial installed records"
		, "Enforce installed nested checked-record WIT acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.equal(step(names[3]), "        timeout-minutes: 20\n        run: |\n          sudo apt-get update\n          sudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep xz-utils zstd\n");
	assert.equal(step(names[4]), "        timeout-minutes: 30\n        shell: bash\n        run: |\n" + indent(toolchains));
	assert.equal(step(names[5]), "        timeout-minutes: 30\n        shell: bash\n        run: |\n" + indent(capi));
	assert.equal(step(names[6]), "        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n        run: |\n" + indent(acceptance));
	assert.equal(step(names[7]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nested-checked-record-wit-${{ github.sha }}\n          path: |\n            build/nested-checked-record-wit-ci/\n            build/nested-checked-record-wit-toolchain.log\n          if-no-files-found: error\n          retention-days: 30\n");
	assert.equal(step(names[8]), "        if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1\n");
	assert.doesNotMatch(source, /nix build|cachix\/install-nix/u);
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep xz-utils zstd"
		, toolchains, capi, acceptance, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
