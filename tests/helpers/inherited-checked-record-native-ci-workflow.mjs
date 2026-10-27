/**
 * Validate the dedicated inherited checked-record C/C++ workflow.
 *
 * @file
 */
import assert from "node:assert/strict";
import {
	assertWorkflowRunBudget, workflowRunScalars
} from "./native-observation-split.mjs";

/**
 * Refuse workflow shortcuts and require the exact hosted command.
 *
 * @param source - Complete inherited-checked-record-native.yml source.
 */
export const assertInheritedCheckedRecordNativeWorkflow = source => {
	assert.ok(source.startsWith(
		"name: Installed inherited checked records in C and C++\n"));
	assert.ok(source.includes("on:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: inherited-checked-record-native-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual(
		[...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)]
			.map(match => match[1]), [
			"workflow_dispatch"
			, "inherited-checked-record-native"
			]
	);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:|LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NATIVE_|install-nix|nix build|setup-python/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), [
		"        if: always()"
		, "        if: always() && steps.acceptance.outcome != 'success'"
	]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 1);
	assert.ok(source.includes('    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)]
		.map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Bound apt network waits"
		, "Install compiler and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Require both source routes and API modes in C and C++"
		, "Preserve original and partial installed records"
		, "Enforce installed inherited checked-record acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1]
		.split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	assert.equal(step(names[2])
		, "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[5]).startsWith(
		"        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n"));
	assert.equal(step(names[6]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: inherited-checked-record-native-${{ github.sha }}\n          path: |\n            build/inherited-checked-record-native-ci/\n            build/inherited-checked-record-native-toolchain.log\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git jq libgmp-dev libuv1-dev m4 pkg-config ripgrep xz-utils zstd"
		, "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\nbash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/inherited-checked-record-native-toolchain.log"
		, "set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-inherited-checked-record-native-ci.sh"
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
