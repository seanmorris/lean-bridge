/**
 * Require all native PHP source/API selections with explicit hosted tools.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

/**
 * Check the dedicated native PHP workflow and exact executable commands.
 *
 * @param source - Complete nominal-primitive-subtype-php.yml source.
 */
export const assertNominalPrimitiveSubtypePhpWorkflow = source => {
	assert.ok(source.startsWith("name: Installed primitive-base nominal Subtypes in native PHP\n"));
	assert.ok(source.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nominal-primitive-subtype-php-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1])
		, ["push", "pull_request", "workflow_dispatch", "nominal-primitive-subtype-php"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:|LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PHP_|install-nix|nix build|setup-python|setup-ruby/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes('    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n")); assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Bound apt network waits"
		, "Install compiler, PHP, Composer, and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Require both source routes and API modes in native PHP"
		, "Preserve original and partial installed records"
		, "Enforce installed primitive-base native PHP acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[5]).startsWith("        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n"));
	assert.equal(step(names[6]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nominal-primitive-subtype-php-${{ github.sha }}\n          path: |\n            build/nominal-primitive-subtype-php-ci/\n            build/nominal-primitive-subtype-php-toolchain.log\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake composer git jq libgmp-dev libuv1-dev m4 php-cli php-common php-dev php-mbstring php-zip pkg-config ripgrep xz-utils zstd"
		, "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\nbash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/nominal-primitive-subtype-php-toolchain.log"
		, 'set -euo pipefail\nsource scripts/env.sh\nphp_command=$(command -v php)\ncomposer_command=$(command -v composer)\nbash scripts/run-nominal-primitive-subtype-php-ci.sh "$php_command" "$composer_command"'
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
