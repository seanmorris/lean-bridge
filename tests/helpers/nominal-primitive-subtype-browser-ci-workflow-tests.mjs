/**
 * Reject narrowed primitive-base browser gates and preserve every original failure record.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalPrimitiveSubtypeBrowserWorkflow } from "./nominal-primitive-subtype-browser-ci-workflow.mjs";

test("primitive-base browser workflow requires all selections and original failure records", async () => {
	const source = await readFile(".github/workflows/nominal-primitive-subtype-browser.yml", "utf8");
	assertNominalPrimitiveSubtypeBrowserWorkflow(source);
	const shell = await readFile("scripts/run-nominal-primitive-subtype-browser-ci.sh", "utf8");
	for(const command of [
		"for route in ordinary reviewed; do", "for mode in full result-only; do"
		, "export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST=1"
		, "export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_BROWSER_TEST=1"
		, "export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"
		, "node scripts/check-nominal-primitive-subtype-browser-ci.mjs"
		, 'export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"'
		, "export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1 EMCC_CORES=1 CMAKE_BUILD_PARALLEL_LEVEL=1"
	]) assert.ok(shell.includes(command), command);
	assert.ok(shell.indexOf('mkdir "$output_root"') < shell.indexOf('export LEAN_BRIDGE_NOMINAL_PRIMITIVE_SUBTYPE_NPM_TEST=1'));
	const entry = await readFile("tests/helpers/nominal-primitive-subtype-tests.mjs", "utf8");
	for(const name of ["ci-policy-tests", "ci-shell-tests", "ci-workflow-tests"])
		assert.ok(entry.includes(`import "./nominal-primitive-subtype-browser-${name}.mjs";`));
});

test("primitive-base browser workflow controls reject acceptance bypasses and ambient runtimes", async t => {
	const source = await readFile(".github/workflows/nominal-primitive-subtype-browser.yml", "utf8");
	const replacements = [
		["bash scripts/install-playwright-browsers.sh chromium firefox webkit", "bash scripts/install-playwright-browsers.sh chromium"]
		, ["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["node --test --test-name-pattern=", "true --test --test-name-pattern="]
		, ["|filtered Nix engine", "|unknown filtered test"]
		, ["bash scripts/bootstrap-toolchains.sh", "true missing-tools"]
		, ["nix build .#component-build-engine", "true missing-engine"]
		, ["bash scripts/build-lean-link-spike.sh", "true missing-runtime"]
		, ["build/locked-lake-engine/bin/lean-bridge-component-engine", "/ambient/engine"]
		, ['"$PWD/build/lean-link-spike/lazy"', '"/ambient/runtime"']
		, ["    env:\n", "    env:\n      LEAN_BRIDGE_LAKE_RUNTIME_ROOT: /ambient/runtime\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        continue-on-error: true\n"]
		, ['bash scripts/run-nominal-primitive-subtype-browser-ci.sh "$PWD/build/lean-link-spike/lazy"', "true missing-matrix"]
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/nominal-primitive-subtype-browser-ci/\n", "build/nominal-primitive-subtype-browser-ci/ordinary-full/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 180", "timeout-minutes: 360"]
		, ["        id: acceptance\n        timeout-minutes: 90", "        id: acceptance\n        timeout-minutes: 1"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source); assert.throws(() => assertNominalPrimitiveSubtypeBrowserWorkflow(changed), before);
	}
	t.diagnostic(`${replacements.length} workflow bypasses refused`);
});
