/**
 * Require the exact callback-result suite, installed reports and summary gate.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedRustCallbackResultTestNames = [
	"owned-rust-callback-results", "owned-rust-callback-result-runtime"
	, "owned-rust-callback-result-packaging"
	, "owned-rust-callback-result-combined-packaging"
];
export const ownedRustCallbackResultScript = "LEAN_BRIDGE_OWNED_RUST_CALLBACK_RESULT_TEST=1 node --test --test-concurrency=1 "
	+ ownedRustCallbackResultTestNames.map(name => `tests/${name}.test.mjs`).join(" ");
export const ownedRustCallbackResultReports = ["ordinary", "reviewed"].flatMap(mode => [
	`${mode}-no-host.json`, `${mode}-host.json`
	, `${mode}-combined.json`, `${mode}-no-host-package.json`
	, `${mode}-combined-package.json`, `${mode}-combined-release.json`
]).map(path => "build/owned-rust-callback-results/" + path);

/**
 * Reject omitted cases, skipped execution, missing artifacts and optional jobs.
 *
 * @param workflow - Complete consumer workflow source.
 * @param manifest - Repository package scripts.
 */
export const assertOwnedRustCallbackResultCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-rust-callback-results"], ownedRustCallbackResultScript);
	const job = workflow.split("  owned-rust-callback-results:\n")[1]?.split(/\n {2}[a-z][a-z0-9-]*:\n/u)[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 150$/mu);
	assert.match(job, /sudo apt-get install -y [^\n]*\bm4\b[^\n]*\bripgrep\b/u);
	assert.match(job, /bash scripts\/bootstrap-toolchains\.sh/u);
	assert.match(job, /bash scripts\/bootstrap-rust-ci\.sh/u);
	assert.match(job, /bash scripts\/build-lean-link-spike\.sh/u);
	// The combined package is checked in all three engines; a slow apt mirror gets a bounded second attempt.
	const browsers = job.split("      - name: Install all callback browser engines\n")[1]?.split("      - name: ")[0];
	assert.equal(browsers, "        timeout-minutes: 20\n        run: bash scripts/install-playwright-browsers.sh chromium firefox webkit\n");
	const step = job.split("      - name: Verify Rust callback-result lifetimes\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	const lines = step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, "");
	assert.equal(lines, ["set -euo pipefail", "source scripts/env.sh"
		, "npm run test:owned-rust-callback-results 2>&1 | tee build/owned-rust-callback-results.log"
		, ...["tests 13", "pass 13", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-rust-callback-results.log`)
		, ...ownedRustCallbackResultReports.map(path => "test -s " + path)].join("\n"));
	const upload = job.split("      - name: Preserve Rust callback-result acceptance\n")[1];
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-rust-callback-results/", "build/owned-rust-callback-results.log", "build/owned-rust-callback-result-runtime.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-rust-callback-results$/mu);
	assert.ok(summary.includes("        if: needs.owned-rust-callback-results.result != 'success'\n        run: exit 1\n"));
	return { tests: 13, testFiles: 4, reports: 12, failurePropagated: true };
};
