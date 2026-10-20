/**
 * Controls for the separate recurring npm/browser entry measurement lane.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { nominalSubtypeEntryRecordPaths } from "./nominal-subtype-entry-npm.mjs";
import { parseNominalSubtypeEntryBrowserCiArgs } from "./nominal-subtype-entry-browser-ci-report.mjs";

const argsOf = options => Object.entries(options).flatMap(([key, value]) => ["--" + key, value]);

test("nominal entry browser checker requires one explicit closed selection", () => {
	const options = { route: "ordinary", mode: "full", producer: "a".repeat(40)
		, directory: "records", tap: "run.tap", runtime: "runtime.json" };
	const args = argsOf(options); assert.deepEqual(parseNominalSubtypeEntryBrowserCiArgs(args), options);
	for(const key of Object.keys(options))
		assert.throws(() => parseNominalSubtypeEntryBrowserCiArgs(argsOf(Object.fromEntries(Object.entries(options).filter(([name]) => name !== key)))));
	for(const changes of [{ route: "unknown" }, { mode: "unknown" }, { producer: "HEAD" }, { extra: "yes" }])
		assert.throws(() => parseNominalSubtypeEntryBrowserCiArgs(argsOf({ ...options, ...changes })));
});

test("nominal entry record inventory distinguishes Node and browser observations", () => {
	const node = nominalSubtypeEntryRecordPaths(), browser = nominalSubtypeEntryRecordPaths({ browser: true });
	assert.equal(node.length, 6); assert.equal(browser.length, 13);
	assert.deepEqual(browser.slice(0, node.length), node);
	assert.deepEqual(browser.slice(-4), ["entry/browser/chromium.console.txt"
		, "entry/browser/firefox.console.txt", "entry/browser/webkit.console.txt"
		, "entry/browser/browser.json"]);
	assert.equal(new Set(browser).size, browser.length);
});

test("nominal entry browser workflow keeps measurement separate and mandatory", async () => {
	const workflow = await readFile(".github/workflows/nominal-subtype-entry-browser.yml", "utf8");
	const shell = await readFile("scripts/run-nominal-subtype-entry-browser-ci.sh", "utf8");
	assert.ok(workflow.includes("on:\n  push:\n  pull_request:\n  workflow_dispatch:\n"));
	assert.ok(workflow.includes("fetch-depth: 0\n          persist-credentials: false"));
	assert.ok(workflow.includes("bash scripts/run-nominal-subtype-entry-browser-ci.sh"));
	assert.ok(workflow.includes("if: always() && steps.acceptance.outcome != 'success'"));
	assert.ok(workflow.includes("build/nominal-subtype-entry-browser-ci/"));
	for(const source of ["export LEAN_BRIDGE_NOMINAL_SUBTYPE_NPM_ENTRY=1"
		, "for route in ordinary reviewed; do", "for mode in full result-only; do"
		, "chromium,firefox,webkit", "check-nominal-subtype-entry-browser-ci.mjs"])
		assert.ok(shell.includes(source), source);
	assert.doesNotMatch(workflow, /continue-on-error:|if-no-files-found: ignore/u);
});
