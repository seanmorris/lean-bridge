/**
 * Require the complete value-index .NET workflow on pinned toolchains.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	assertWorkflowRunBudget, workflowRunScalars
} from "./native-observation-split.mjs";

/**
 * Check the dedicated workflow without weakening any older consumer gate.
 *
 * @param source - Complete checked-record-value-index-dotnet.yml source.
 */
export const assertCheckedRecordValueIndexDotnetWorkflow = source => {
	assert.ok(source.startsWith(
		"name: Installed value-index checked records in .NET\n"
	));
	assert.ok(source.includes(
		"on:\n  workflow_dispatch:\n"
	));
	assert.ok(source.includes(`    inputs:
      max-load:
        description: Maximum admitted one-minute host load
        required: false
        default: "6"
        type: choice
        options:
          - "6"
          - "8"
          - "10"
          - "12"
`));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes(`concurrency:
  group: checked-record-value-index-dotnet-${"${{ github.ref }}"}
  cancel-in-progress: true
`));
	assert.deepEqual(
		[...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
			.map(match => match[1])
		, ["workflow_dispatch"
			, "checked-record-value-index-dotnet"]
	);
	assert.doesNotMatch(source
		, /continue-on-error:|needs:|strategy:|defaults:|install-nix|nix build|setup-python|setup-ruby/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), [
		"        if: always()"
		, "        if: always() && steps.acceptance.outcome != 'success'"
	]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 2);
	assert.ok(source.includes(
		'    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'
	));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)]
		.map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Install the isolated pinned .NET SDK"
		, "Require every source and API route in .NET"
		, "Preserve original and partial installed records"
		, "Enforce installed value-index checked-record .NET acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1]
		.split("      - name: ")[0];
	assert.equal(step(names[0])
		, "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1])
		, '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2])
		, "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.equal(step(names[5]), `        timeout-minutes: 20
        uses: actions/setup-dotnet@v6
        env:
          DOTNET_INSTALL_DIR: ${"${{ runner.temp }}"}/lean-bridge-value-index-dotnet-8.0.424
        with:
          dotnet-version: '8.0.424'
`);
	assert.ok(step(names[6]).startsWith(
		"        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n"
	));
	assert.equal(step(names[7]), `        if: always()
        uses: actions/upload-artifact@v7
        with:
          name: checked-record-value-index-dotnet-${"${{ github.sha }}"}
          path: |
            build/checked-record-value-index-dotnet-ci/
            build/checked-record-value-index-dotnet-toolchain.log
          include-hidden-files: true
          if-no-files-found: error
          retention-days: 30
`);
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep xz-utils zstd"
		, "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\nbash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/checked-record-value-index-dotnet-toolchain.log"
		, `set -euo pipefail
source scripts/env.sh
bash scripts/run-checked-record-value-index-dotnet-ci.sh "$RUNNER_TEMP/lean-bridge-value-index-dotnet-8.0.424/dotnet" "${"${{ inputs.max-load || '6' }}"}"`
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
