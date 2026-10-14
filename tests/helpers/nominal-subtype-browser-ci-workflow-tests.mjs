/**
 * Keep installed nominal browser acceptance mandatory and isolated from the long Node job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertNominalSubtypeBrowserWorkflow } from "./nominal-subtype-browser-ci-workflow.mjs";

test("nominal browser workflow requires pinned tools, both routes and API modes, and original failure records", async () => {
	const source = await readFile(".github/workflows/nominal-subtype-browser.yml", "utf8");
	assertNominalSubtypeBrowserWorkflow(source);
	const shell = await readFile("scripts/run-nominal-subtype-browser-ci.sh", "utf8");
	for(const command of [
		"for route in ordinary reviewed; do"
		, "for mode in full result-only; do"
		, "export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST=1"
		, "export LEAN_BRIDGE_NOMINAL_SUBTYPE_BROWSER_TEST=1"
		, "export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"
		, "node scripts/check-nominal-subtype-browser-ci.mjs"
		, 'cmp "$output/runtime-before.json" "$output/runtime-after.json"'
	]) assert.ok(shell.includes(command), command);
	assert.ok(shell.indexOf('mkdir "$output_root"') < shell.indexOf('export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_TEST=1'));
	assert.ok(shell.includes('export LEAN_NUM_THREADS=1 OMP_NUM_THREADS=1 MAKEFLAGS=-j1'));
});

test("nominal browser workflow controls reject narrowed coverage and acceptance bypasses", async t => {
	const source = await readFile(".github/workflows/nominal-subtype-browser.yml", "utf8");
	const replacements = [
		["  push:\n", ""], ["  pull_request:\n", ""]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["npm ci --ignore-scripts", "npm install"]
		, ["node --test --test-name-pattern=", "true --test --test-name-pattern="]
		, ["|filtered Nix engine", "|unknown filtered test"]
		, ["bash scripts/bootstrap-toolchains.sh", "true missing-tools"]
		, ["chromium firefox webkit", "chromium"]
		, ["nix build .#component-build-engine", "true missing-engine"]
		, ["bash scripts/build-lean-link-spike.sh", "true missing-runtime"]
		, ["build/locked-lake-engine/bin/lean-bridge-component-engine", "/ambient/engine"]
		, ["LEAN_BRIDGE_LAKE_RUNTIME_ROOT: build/lean-link-spike/lazy", "LEAN_BRIDGE_LAKE_RUNTIME_ROOT: /ambient/runtime"]
		, ["        id: acceptance\n", "        id: acceptance\n        if: false\n"]
		, ["        id: acceptance\n", "        id: acceptance\n        continue-on-error: true\n"]
		, ["bash scripts/run-nominal-subtype-browser-ci.sh", "bash scripts/run-nominal-subtype-browser-ci.sh || true"]
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/nominal-subtype-browser-ci/\n", "build/nominal-subtype-browser-ci/ordinary/full/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 180", "timeout-minutes: 360"]
		, ["timeout-minutes: 90", "timeout-minutes: 1"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source); assert.throws(() => assertNominalSubtypeBrowserWorkflow(changed), before);
	}
	t.diagnostic(`${replacements.length} workflow bypasses refused`);
});
