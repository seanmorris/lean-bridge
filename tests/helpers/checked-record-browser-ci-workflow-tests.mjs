/**
 * Keep recurring installed browser acceptance mandatory and separate from the long Node job.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assertCheckedRecordBrowserWorkflow } from "./checked-record-browser-ci-workflow.mjs";

test("the dedicated checked-record workflow requires pinned inputs, four routes and original failure artifacts", async () => {
	const source = await readFile(".github/workflows/checked-record-browser.yml", "utf8");
	assertCheckedRecordBrowserWorkflow(source);
	const shell = await readFile("scripts/run-checked-record-browser-ci.sh", "utf8");
	assert.ok(shell.includes("for route in ordinary-source reviewed-ir result-only-ordinary-source result-only-reviewed-ir; do"));
	assert.ok(shell.includes("export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"));
	assert.ok(shell.includes("node scripts/check-checked-record-browser-ci.mjs"));
});

test("browser workflow controls refuse skipped acceptance, narrowed records and unlocked inputs", async t => {
	const source = await readFile(".github/workflows/checked-record-browser.yml", "utf8");
	const replacements = [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
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
		, ["bash scripts/run-checked-record-browser-ci.sh", "bash scripts/run-checked-record-browser-ci.sh || true"]
		, ["source scripts/env.sh", "set +e"]
		, ["if: always()\n", "if: success()\n"]
		, ["build/checked-record-browser-ci/\n", "build/checked-record-browser-ci/ordinary-source/records/report.json\n"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unmeasured.outcome"]
		, ["run: exit 1", "run: exit 0"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source); assert.throws(() => assertCheckedRecordBrowserWorkflow(changed), before);
	}
	t.diagnostic(`${replacements.length} workflow bypasses refused`);
});
