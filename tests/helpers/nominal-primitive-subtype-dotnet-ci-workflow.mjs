/**
 * Require all primitive-base .NET source/API selections on pinned toolchains.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertNominalPrimitiveSubtypeHistoryCheckout } from "./nominal-primitive-subtype-history-checkout.mjs";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

/**
 * Check the dedicated .NET workflow without weakening any older consumer gate.
 *
 * @param source - Complete nominal-primitive-subtype-dotnet.yml source.
 */
export const assertNominalPrimitiveSubtypeDotnetWorkflow = source => {
	assert.ok(source.startsWith("name: Installed primitive-base nominal Subtypes in .NET\n"));
	assert.ok(source.includes("on:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nominal-primitive-subtype-dotnet-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), [
		"workflow_dispatch"
		, "nominal-primitive-subtype-dotnet"
	]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:|LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_DOTNET_|install-nix|nix build|setup-python|setup-ruby/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), [
		"        if: always()"
		, "        if: always() && steps.acceptance.outcome != 'success'"
	]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 2);
	assert.ok(source.includes('    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Install the isolated pinned .NET SDK"
		, "Require both source routes and API modes in .NET"
		, "Preserve original and partial installed records"
		, "Enforce installed primitive-base .NET acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assertNominalPrimitiveSubtypeHistoryCheckout(step(names[0]));
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.equal(step(names[5]), "        timeout-minutes: 20\n        uses: actions/setup-dotnet@v6\n        env:\n          DOTNET_INSTALL_DIR: ${{ runner.temp }}/lean-bridge-nominal-primitive-dotnet-8.0.424\n        with:\n          dotnet-version: '8.0.424'\n");
	assert.ok(step(names[6]).startsWith("        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n"));
	assert.equal(step(names[7]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nominal-primitive-subtype-dotnet-${{ github.sha }}\n          path: |\n            build/nominal-primitive-subtype-dotnet-ci/\n            build/nominal-primitive-subtype-dotnet-toolchain.log\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep xz-utils zstd"
		, "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\nbash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/nominal-primitive-subtype-dotnet-toolchain.log"
		, 'set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-nominal-primitive-subtype-dotnet-ci.sh "$RUNNER_TEMP/lean-bridge-nominal-primitive-dotnet-8.0.424/dotnet"'
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
