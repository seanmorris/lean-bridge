/**
 * Require independent Python floors and complete installed inherited checked-record records.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertWorkflowRunBudget, workflowRunScalars } from "./native-observation-split.mjs";

/**
 * Check the dedicated workflow without weakening the existing consumer matrix.
 *
 * @param source - Complete inherited-checked-record-python.yml source.
 */
export const assertInheritedCheckedRecordPythonWorkflow = source => {
	assert.ok(source.startsWith("name: Installed inherited checked records in Python\n"));
	assert.ok(source.includes("on:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("concurrency:\n  group: inherited-checked-record-python-${{ github.ref }}\n  cancel-in-progress: true\n"));
	assert.deepEqual([...source.matchAll(/^ {2}([a-z][a-z0-9_-]*):\n/gmu)].map(match => match[1]), ["workflow_dispatch", "inherited-checked-record-python"]);
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|defaults:|LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR:|LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PYTHONS:|LEAN_BRIDGE_INHERITED_CHECKED_RECORD_PYTHON_MAX_LOAD:/u);
	assert.deepEqual(source.match(/^\s+if:.*$/gmu), ["        if: always()", "        if: always() && steps.acceptance.outcome != 'success'"]);
	assert.equal((source.match(/^\s+env:/gmu) ?? []).length, 2);
	assert.ok(source.includes('    env:\n      LEAN_NUM_THREADS: "1"\n    steps:\n'));
	assert.ok(source.includes("    runs-on: ubuntu-24.04\n"));
	assert.ok(source.includes("    timeout-minutes: 180\n"));
	const names = [...source.matchAll(/^ {6}- name: (.+)$/gmu)].map(match => match[1]);
	assert.deepEqual(names, [
		"Check out the exact revision and original evidence history"
		, "Install Node.js", "Select Python 3.11", "Select Python 3.12"
		, "Bound apt network waits", "Install compiler and archive dependencies"
		, "Install dependencies and the pinned Lean compiler"
		, "Require both source routes and API modes on both Python floors"
		, "Preserve original and partial installed records"
		, "Enforce installed inherited checked-record Python acceptance"
	]);
	const step = name => source.split("      - name: " + name + "\n")[1].split("      - name: ")[0];
	assert.equal(step(names[0]), "        uses: actions/checkout@v6\n        with:\n          fetch-depth: 0\n          persist-credentials: false\n");
	assert.equal(step(names[1]), '        uses: actions/setup-node@v6\n        with:\n          node-version: "22"\n          cache: npm\n');
	for(const minor of ["3.11", "3.12"])
		assert.equal(step("Select Python " + minor), `        id: python${minor.replace(".", "")}\n        uses: actions/setup-python@v7\n        with:\n          python-version: "${minor}"\n`);
	assert.equal(step(names[4]), "        uses: ./.github/actions/bounded-apt\n        timeout-minutes: 1\n");
	assert.ok(step(names[7]).startsWith("        id: acceptance\n        timeout-minutes: 120\n        shell: bash\n        env:\n          INHERITED_PYTHON_311: ${{ steps.python311.outputs.python-path }}\n          INHERITED_PYTHON_312: ${{ steps.python312.outputs.python-path }}\n"));
	assert.equal(step(names[8]), "        if: always()\n        uses: actions/upload-artifact@v7\n        with:\n          name: inherited-checked-record-python-${{ github.sha }}\n          path: |\n            build/inherited-checked-record-python-ci/\n            build/inherited-checked-record-python-toolchain.log\n          if-no-files-found: error\n          retention-days: 30\n");
	const commands = workflowRunScalars(source).map(run => run.source.trim());
	assert.deepEqual(commands, [
		"sudo apt-get update\nsudo apt-get install -y build-essential cmake git libgmp-dev libuv1-dev m4 pkg-config python3-venv ripgrep unzip xz-utils zip zstd"
		, "set -euo pipefail\nnpm ci --ignore-scripts --no-audit --no-fund\nmkdir -p build\nbash scripts/bootstrap-toolchains.sh --lean-only 2>&1 | tee build/inherited-checked-record-python-toolchain.log"
		, 'set -euo pipefail\nsource scripts/env.sh\nbash scripts/run-inherited-checked-record-python-ci.sh "$INHERITED_PYTHON_311" "$INHERITED_PYTHON_312"'
		, "exit 1"
	]);
	assert.equal(assertWorkflowRunBudget(source), commands.length);
};
