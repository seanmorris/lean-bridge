/**
 * Keep the hosted inherited checked-record matrix mandatory and source-free at execution.
 *
 * @file
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const assertWorkflow = source => {
	assert.ok(source.startsWith("name: Inherited checked records in npm and browsers\n"));
	assert.ok(source.includes("on:\n  workflow_dispatch:\n"));
	assert.ok(source.includes("permissions:\n  contents: read\n"));
	assert.ok(source.includes("runs-on: ubuntu-24.04"));
	assert.ok(source.includes("timeout-minutes: 240"));
	assert.ok(source.includes("fetch-depth: 0"));
	assert.ok(source.includes("persist-credentials: false"));
	assert.ok(source.includes('node-version: "22"'));
	assert.ok(source.includes("bash scripts/install-playwright-browsers.sh chromium firefox webkit"));
	assert.ok(source.includes("nix build .#component-build-engine"));
	assert.ok(source.includes("bash scripts/build-lean-link-spike.sh"));
	assert.ok(source.includes('bash scripts/run-inherited-checked-record-browser-ci.sh "$PWD/build/lean-link-spike/lazy"'));
	assert.ok(source.includes("if: always() && steps.acceptance.outcome != 'success'"));
	assert.ok(source.includes("if-no-files-found: error"));
	assert.ok(source.includes("run: exit 1"));
	assert.doesNotMatch(source, /continue-on-error:|needs:|strategy:|LEAN_BRIDGE_LAKE_RUNTIME_ROOT:/u);
};

test("inherited checked-record browser workflow requires every route and retains failures", async () => {
	const workflow = await readFile(".github/workflows/inherited-checked-record-browser.yml", "utf8");
	assertWorkflow(workflow);
	const shell = await readFile("scripts/run-inherited-checked-record-browser-ci.sh", "utf8");
	for(const source of [
		"for route in ordinary-full ordinary-result-only reviewed-full reviewed-result-only; do"
		, "export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_NPM_TEST=1"
		, "export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_TEST=1"
		, "export LEAN_BRIDGE_INHERITED_CHECKED_RECORD_BROWSER_CONTROLS_TEST=1"
		, "export LEAN_BRIDGE_TYPE_CORPUS_BROWSERS=chromium,firefox,webkit"
		, "node scripts/check-inherited-checked-record-browser-ci.mjs"
		, 'export LEAN_BRIDGE_LAKE_RUNTIME_ROOT="$1"'
	]) assert.ok(shell.includes(source), source);
	execFileSync("bash", ["-n", "scripts/run-inherited-checked-record-browser-ci.sh"]);
});

test("inherited checked-record browser workflow refuses common acceptance bypasses", async t => {
	const source = await readFile(".github/workflows/inherited-checked-record-browser.yml", "utf8");
	const replacements = [
		["  workflow_dispatch:\n", "  push:\n  workflow_dispatch:\n"]
		, ["  workflow_dispatch:\n", "  pull_request:\n  workflow_dispatch:\n"]
		, ["contents: read", "contents: write"]
		, ["fetch-depth: 0", "fetch-depth: 1"]
		, ["persist-credentials: false", "persist-credentials: true"]
		, ['node-version: "22"', 'node-version: "latest"']
		, ["chromium firefox webkit", "chromium"]
		, ["nix build .#component-build-engine", "true missing-engine"]
		, ["bash scripts/build-lean-link-spike.sh", "true missing-runtime"]
		, ['bash scripts/run-inherited-checked-record-browser-ci.sh "$PWD/build/lean-link-spike/lazy"', "true missing-matrix"]
		, ["if-no-files-found: error", "if-no-files-found: ignore"]
		, ["steps.acceptance.outcome", "steps.unknown.outcome"]
		, ["run: exit 1", "run: exit 0"]
		, ["timeout-minutes: 240", "timeout-minutes: 1"]
	];
	for(const [before, after] of replacements)
	{
		const changed = source.replace(before, after);
		assert.notEqual(changed, source); assert.throws(() => assertWorkflow(changed));
	}
	t.diagnostic(`${replacements.length} workflow bypasses refused`);
});
