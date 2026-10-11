/**
 * Require the dedicated browser job's inputs, all four routes, records and failure enforcement.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

/**
 * Inspect the complete job so conditions and extra shell commands cannot bypass acceptance.
 *
 * @param source - Complete checked-record-browser.yml source.
 */
export const assertCheckedRecordBrowserWorkflow = source => {
	assert.ok(source.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: checked-record-browser-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["push", "pull_request", "workflow_dispatch", "checked-record-browser"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes('    env:\n      EMCC_CORES: "2"\n      LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine\n      LEAN_BRIDGE_LAKE_RUNTIME_ROOT: build/lean-link-spike/lazy\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js"
		, "Install Nix", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and pinned compiler tools"
		, "Install Chromium, Firefox and WebKit", "Build the locked component engine"
		, "Build the pinned shared Wasm runtime"
		, "Require ordinary, reviewed and both result-only installed packages"
		, "Preserve original and partial installed records"
		, "Enforce installed browser acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: cachix/install-nix-action@v31\n");
	assert.equal(step(names[3]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[9]).startsWith("        id: acceptance\n        timeout-minutes: 60\n        shell: bash\n"));
	assert.equal(step(names[10]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: checked-record-browser-${{ github.sha }}\n          path: |\n            build/checked-record-browser-ci/\n            build/checked-record-browser-engine.log\n            build/checked-record-browser-runtime.log\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev pkg-config python3 ripgrep xz-utils zstd"
		, "npm ci --ignore-scripts --no-audit --no-fund\nbash scripts/bootstrap-toolchains.sh"
		, "bash scripts/install-playwright-browsers.sh chromium firefox webkit"
		, "set -euo pipefail\nmkdir -p build\nnix build .#component-build-engine --out-link build/locked-lake-engine 2>&1 | tee build/checked-record-browser-engine.log\ntest -x build/locked-lake-engine/bin/lean-bridge-component-engine"
		, "set -euo pipefail\nbash scripts/build-lean-link-spike.sh 2>&1 | tee build/checked-record-browser-runtime.log\ntest -s build/lean-link-spike/lazy/main.wasm"
		, "set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-checked-record-browser-ci.sh"
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
