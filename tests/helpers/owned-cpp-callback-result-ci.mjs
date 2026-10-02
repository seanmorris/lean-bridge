/**
 * Require the exact callback-result suite, installed reports and summary gate.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedCppCallbackResultTestNames = [
	"owned-cpp-callback-results", "owned-cpp-callback-result-packaging"
	, "owned-cpp-callback-result-combined-packaging"
];
export const ownedCppCallbackResultScript = "LEAN_BRIDGE_OWNED_CPP_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 "
	+ ownedCppCallbackResultTestNames.map(name => `tests/${name}.test.mjs`).join(" ");
export const ownedCppCallbackResultReports = ["ordinary", "reviewed"].flatMap(mode => [
	`${mode}-base-nohost.json`, `${mode}-base-host.json`
	, `${mode}-combined.json`, `${mode}-no-host-package.json`
	, `${mode}-combined-package.json`, `${mode}-combined-release.json`
]).map(path => "build/owned-cpp-callback-results/" + path);

/**
 * Reject omitted cases, skipped execution, missing artifacts and optional jobs.
 *
 * @param workflow - Complete consumer workflow source.
 * @param manifest - Repository package scripts.
 */
export const assertOwnedCppCallbackResultCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-cpp-callback-results"], ownedCppCallbackResultScript);
	const job = workflow.split("  owned-cpp-callback-results:\n")[1]?.split("\n  owned-callback-results:\n")[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 150$/mu);
	assert.match(job, /sudo apt-get install -y [^\n]*\bm4\b[^\n]*\bripgrep\b/u);
	assert.match(job, /bash scripts\/bootstrap-toolchains\.sh/u);
	assert.match(job, /bash scripts\/build-lean-link-spike\.sh/u);
	assert.match(job, /npx playwright install --with-deps chromium firefox webkit/u);
	const step = job.split("      - name: Verify C++ callback-result lifetimes\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	const lines = step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, "");
	assert.equal(lines, ["set -euo pipefail", "source scripts/env.sh"
		, "npm run test:owned-cpp-callback-results 2>&1 | tee build/owned-cpp-callback-results.log"
		, ...["tests 12", "pass 12", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-cpp-callback-results.log`)
		, ...ownedCppCallbackResultReports.map(path => "test -s " + path)].join("\n"));
	const upload = job.split("      - name: Preserve C++ callback-result acceptance\n")[1];
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-cpp-callback-results/", "build/owned-cpp-callback-results.log", "build/owned-cpp-callback-result-runtime.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-cpp-callback-results$/mu);
	assert.ok(summary.includes("        if: needs.owned-cpp-callback-results.result != 'success'\n        run: exit 1\n"));
	return { tests: 12, testFiles: 3, reports: 12, failurePropagated: true };
};
