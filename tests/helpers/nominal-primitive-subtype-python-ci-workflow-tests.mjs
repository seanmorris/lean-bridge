/**
 * Refuse missing Python floors, skipped installed matrices and narrowed failure evidence.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalPrimitiveSubtypePythonWorkflow } from "./nominal-primitive-subtype-python-ci-workflow.mjs";

test("primitive-base Python workflow requires four source/API selections on both floors", async () => {
	const source = await readFile(".github/workflows/nominal-primitive-subtype-python.yml", "utf8");
	assertNominalPrimitiveSubtypePythonWorkflow(source);
	const shell = await readFile("scripts/run-nominal-primitive-subtype-python-ci.sh", "utf8");
	for(const command of [
		"for route in ordinary reviewed; do", "for mode in full result-only; do"
		, "export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_TEST=1"
		, "export LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR=2.38"
		, "node scripts/check-nominal-primitive-subtype-python-ci.mjs"
		, "export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 CMAKE_BUILD_PARALLEL_LEVEL=1"
	]) assert.ok(shell.includes(command), command);
	assert.ok(shell.indexOf('mkdir "$output_root"') < shell.indexOf('export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_PYTHON_TEST=1'));
});

test("primitive-base Python workflow rejects missing floors and acceptance bypasses", async t => {
	const source = await readFile(".github/workflows/nominal-primitive-subtype-python.yml", "utf8");
	const replacements = [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ['python-version: "3.11"', 'python-version: "3.12"']
		, ['python-version: "3.12"', 'python-version: "3.13"']
		, ["        id: python311\n", ""]
		, ["        id: python312\n", ""]
		, ["steps.python312.outputs.python-path", "steps.python311.outputs.python-path"]
		, ["npm ci --ignore-scripts", "npm install"]
		, ["bash scripts/bootstrap-toolchains.sh", "true missing-tools"]
		, ["nix build .#component-build-engine", "true missing-engine"]
		, ["build/locked-lake-engine/bin/lean-bridge-component-engine", "/ambient/engine"]
		, ["        id: acceptance\n", "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        continue-on-error: true\n"]
		, ["run-nominal-primitive-subtype-python-ci.sh", "missing-matrix.sh"]
		, [' "$NOMINAL_PYTHON_312"', ""]
		, [' "$NOMINAL_PYTHON_312"', ' "$NOMINAL_PYTHON_311"']
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/nominal-primitive-subtype-python-ci/\n", "build/nominal-primitive-subtype-python-ci/ordinary-full/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 180", "timeout-minutes: 360"]
		, ["        id: acceptance\n        timeout-minutes: 90", "        id: acceptance\n        timeout-minutes: 1"]
		, ["      LEAN_NUM_THREADS:", "      LEAN_BRIDGE_NATIVE_TEST_GLIBC_FLOOR: 2.36\n      LEAN_NUM_THREADS:"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source); assert.throws(() => assertNominalPrimitiveSubtypePythonWorkflow(changed), before);
	}
	assert.equal(replacements.length, 29); t.diagnostic("Twenty-nine workflow bypasses refused");
});
