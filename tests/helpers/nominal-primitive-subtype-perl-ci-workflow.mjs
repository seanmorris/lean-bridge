/**
 * Require all four pinned Perl ABIs and complete installed primitive-base records in a dedicated workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

export const nominalPrimitiveSubtypePerlToolchains = Object.freeze(["5.36.3 threaded", "5.36.3 unthreaded", "5.38.2 threaded", "5.38.2 unthreaded"]);

/**
 * Check the dedicated workflow without weakening the existing Perl consumer matrix.
 *
 * @param source - Complete nominal-primitive-subtype-perl.yml source.
 */
export const assertNominalPrimitiveSubtypePerlWorkflow = source => {
	assert.ok(source.startsWith("name: Installed primitive-base nominal Subtypes in Perl\n"));
	assert.ok(source.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: nominal-primitive-subtype-perl-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["push", "pull_request", "workflow_dispatch", "nominal-primitive-subtype-perl"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|set \+e|\|\| true/u);
	assert.doesNotMatch(source, /LEAN_BRIDGE_(?:(?:NATIVE|PERL)_TEST_GLIBC_FLOOR|NOMINAL_PRIMITIVE_SUBTYPE_PERLS|NOMINAL_SUBTYPE_PERLS|PERLS|CORPUS_PERL)/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes('    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Install the checkout dependencies"
		, "Bound apt network waits", "Install the native build tools"
		, "Install only the pinned Lean compiler"
		, "Restore the complete checksummed Perl toolchain matrix"
		, "Build or verify every pinned Perl interpreter"
		, "Require both source routes and API modes on all four Perl ABIs"
		, "Preserve original and partial installed records"
		, "Enforce installed primitive-base Perl acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2]), "        run: npm ci --ignore-scripts --no-audit --no-fund\n");
	assert.equal(step(names[3]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.equal(step(names[4]), "        timeout-minutes: 20\n        run: sudo apt-get update && sudo apt-get install -y build-essential curl zstd\n");
	assert.equal(step(names[5]), "        run: bash scripts/bootstrap-toolchains.sh --lean-only\n");
	assert.equal(step(names[6]), "        uses: actions/cache@v4\n        with:\n          path: .toolchains/perl\n          key: perl-checked-record-abi-v1-${{ runner.os }}-${{ hashFiles('scripts/build-perl-toolchains.mjs') }}\n");
	assert.equal(step(names[7]), "        run: |\n" + nominalPrimitiveSubtypePerlToolchains.map(configuration => `          node scripts/build-perl-toolchains.mjs ${configuration}\n`).join(""));
	assert.equal(step(names[8]), "        id: acceptance\n        timeout-minutes: 150\n        shell: bash\n        run: |\n          set -euo pipefail\n          source scripts/env.sh\n          bash scripts/run-nominal-primitive-subtype-perl-ci.sh\n");
	assert.equal(step(names[9]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: nominal-primitive-subtype-perl-${{ github.sha }}\n          path: build/nominal-primitive-subtype-perl-ci/\n          if-no-files-found: error\n          retention-days: 30\n");
	assert.equal(step(names[10]), "        if: always() && steps.acceptance.outcome != 'success'\n        run: exit 1\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"npm ci --ignore-scripts --no-audit --no-fund"
		, "sudo apt-get update && sudo apt-get install -y build-essential curl zstd"
		, "bash scripts/bootstrap-toolchains.sh --lean-only"
		, nominalPrimitiveSubtypePerlToolchains.map(configuration => `node scripts/build-perl-toolchains.mjs ${configuration}`).join("\n")
		, "set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-nominal-primitive-subtype-perl-ci.sh"
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
