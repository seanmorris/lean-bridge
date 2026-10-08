/**
 * Require the exact callback-result suite, installed reports and summary gate.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedCallbackResultTestNames = ["contract", "metadata", "layout"
	, "runtime", "c-packaging", "wasm", "wasm-coexistence", "wasm-mutants"
	, "combinations", "npm-packaging", "combined-packaging"];
export const ownedCallbackResultScript = "LEAN_BRIDGE_OWNED_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 "
	+ ownedCallbackResultTestNames.map(name => `tests/owned-callback-result-${name}.test.mjs`).join(" ");
export const ownedCallbackResultReports = ["ordinary", "reviewed"].flatMap(mode => [
	`metadata-${mode}.json`, `runtime-${mode}-false.json`
	, `runtime-${mode}-true.json`
	, `wasm-${mode}-false.json`, `wasm-${mode}-true.json`
	, `coexistence-${mode}-false.json`, `coexistence-${mode}-true.json`
	, `wasm-${mode}-mutants.json`, `wasm-${mode}-combinations.json`
	, `${mode}-c-package.json`, `${mode}-combined-package.json`
]).concat("npm-package.json").map(path => "build/owned-callback-results/" + path);

/**
 * Reject omitted cases, skipped execution, missing artifacts and optional jobs.
 *
 * @param workflow - Complete consumer workflow source.
 * @param manifest - Repository package scripts.
 */
export const assertOwnedCallbackResultCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-callback-results"], ownedCallbackResultScript);
	const job = workflow.split("  owned-callback-results:\n")[1]?.split("\n  node-consumers:\n")[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 150$/mu);
	assert.match(job, /sudo apt-get install -y [^\n]*\bm4\b[^\n]*\bripgrep\b/u);
	assert.match(job, /bash scripts\/bootstrap-toolchains\.sh/u);
	assert.match(job, /bash scripts\/build-lean-link-spike\.sh/u);
	assert.match(job, /bash scripts\/install-playwright-browsers\.sh chromium firefox webkit/u);
	const step = job.split("      - name: Verify callback-result lifetimes\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	const lines = step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, "");
	assert.equal(lines, ["set -euo pipefail", "source scripts/env.sh"
		, "npm run test:owned-callback-results 2>&1 | tee build/owned-callback-results.log"
		, ...["tests 33", "pass 33", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-callback-results.log`)
		, ...ownedCallbackResultReports.map(path => "test -s " + path)].join("\n"));
	const upload = job.split("      - name: Preserve callback-result acceptance\n")[1];
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-callback-results/", "build/owned-callback-results.log", "build/owned-callback-result-runtime.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-callback-results$/mu);
	assert.ok(summary.includes("        if: needs.owned-callback-results.result != 'success'\n        run: exit 1\n"));
	return { tests: 33, testFiles: 11, reports: 23, failurePropagated: true };
};
