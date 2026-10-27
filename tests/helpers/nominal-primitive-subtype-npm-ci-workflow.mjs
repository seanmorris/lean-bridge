/**
 * Keep primitive-base npm acceptance mandatory without extending the long Node job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertNominalPrimitiveSubtypeHistoryCheckout } from "./nominal-primitive-subtype-history-checkout.mjs";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

/**
 * Require pinned tools, one explicit runtime, all installed selections and failure artifacts.
 *
 * @param source - Complete nominal-primitive-subtype-npm.yml source.
 */
export const assertNominalPrimitiveSubtypeNpmWorkflow = source => {
	assert.ok(source.startsWith("name: Installed primitive-base nominal Subtypes in npm\n"));
	assert.ok(source.includes("on:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nominal-primitive-subtype-npm-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["workflow_dispatch", "schedule", "nominal-primitive-subtype-npm"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|LEAN_BRIDGE_LAKE_RUNTIME_ROOT:/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes('    env:\n      EMCC_CORES: "2"\n      LEAN_BRIDGE_LAKE_ENGINE: build/locked-lake-engine/bin/lean-bridge-component-engine\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n")); assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Install Nix", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and pinned compiler tools"
		, "Build the locked component engine"
		, "Build the pinned shared Wasm runtime"
		, "Require both source routes and both primitive-base nominal API modes"
		, "Preserve original and partial installed records"
		, "Enforce installed primitive-base npm acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assertNominalPrimitiveSubtypeHistoryCheckout(step(names[0]));
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: cachix/install-nix-action@v31\n");
	assert.equal(step(names[3]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[8]).startsWith("        id: acceptance\n        timeout-minutes: 60\n        shell: bash\n"));
	assert.equal(step(names[9]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nominal-primitive-subtype-npm-${{ github.sha }}\n          path: |\n            build/nominal-primitive-subtype-npm-ci/\n            build/nominal-primitive-subtype-npm-engine.log\n            build/nominal-primitive-subtype-npm-runtime.log\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev pkg-config python3 ripgrep xz-utils zstd"
		, "npm ci --ignore-scripts --no-audit --no-fund\nnode --test --test-name-pattern='Nix component engine source boundary|filtered Nix engine' tests/engine-execution-request.test.mjs\nbash scripts/bootstrap-toolchains.sh"
		, "set -euo pipefail\nmkdir -p build\nnix build .#component-build-engine --out-link build/locked-lake-engine 2>&1 | tee build/nominal-primitive-subtype-npm-engine.log\ntest -x build/locked-lake-engine/bin/lean-bridge-component-engine"
		, "set -euo pipefail\nbash scripts/build-lean-link-spike.sh 2>&1 | tee build/nominal-primitive-subtype-npm-runtime.log\ntest -s build/lean-link-spike/lazy/main.wasm"
		, 'set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-nominal-primitive-subtype-npm-ci.sh "$PWD/build/lean-link-spike/lazy"'
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
