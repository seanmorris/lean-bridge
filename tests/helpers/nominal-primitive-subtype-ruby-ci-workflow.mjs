/**
 * Require all Ruby source/API selections on the explicitly pinned interpreter.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

/**
 * Check the dedicated Ruby workflow, interpreter and exact executable commands.
 *
 * @param source - Complete nominal-primitive-subtype-ruby.yml source.
 */
export const assertNominalPrimitiveSubtypeRubyWorkflow = source => {
	assert.ok(source.startsWith("name: Installed primitive-base nominal Subtypes in Ruby\n"));
	assert.ok(source.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nominal-primitive-subtype-ruby-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["push", "pull_request", "workflow_dispatch", "nominal-primitive-subtype-ruby"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:|LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_RUBY_|LEAN_BRIDGE_LAKE_ENGINE|install-nix|nix build|setup-python/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes('    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n")); assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Select Ruby 3.3", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Require both source routes and API modes in Ruby"
		, "Preserve original and partial installed records"
		, "Enforce installed primitive-base Ruby acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: ruby/setup-ruby@v1\n        with:\n          ruby-version: '3.3.12'\n");
	assert.equal(step(names[3]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[6]).startsWith("        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n"));
	assert.equal(step(names[7]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nominal-primitive-subtype-ruby-${{ github.sha }}\n          path: |\n            build/nominal-primitive-subtype-ruby-ci/\n            build/nominal-primitive-subtype-ruby-toolchain.log\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep xz-utils zstd"
		, "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\nbash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/nominal-primitive-subtype-ruby-toolchain.log"
		, 'set -euo pipefail\nsource scripts/env.sh\nruby_command=$(command -v ruby)\ngem_command=$(command -v gem)\nbash scripts/run-nominal-primitive-subtype-ruby-ci.sh "$ruby_command" "$gem_command"'
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
