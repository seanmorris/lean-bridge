/**
 * Enforce receiver acceptance independently of the earlier Wasm ownership jobs.
 *
 * @file
 */
import assert from "node:assert/strict";

export const ownedJavaScriptReceiverScript = "LEAN_BRIDGE_OWNED_JS_RECEIVER_TEST=1 node --expose-gc --test --test-concurrency=1 tests/owned-javascript-receiver-model.test.mjs tests/owned-javascript-receiver-package.test.mjs tests/owned-javascript-receivers.test.mjs tests/owned-javascript-receiver-unanchored.test.mjs tests/owned-javascript-receiver-gc.test.mjs tests/owned-javascript-receiver-mutants.test.mjs tests/owned-javascript-receiver-coexistence.test.mjs tests/owned-javascript-receiver-packaging.test.mjs tests/owned-javascript-receiver-resource-packaging.test.mjs";
export const ownedJavaScriptReceiverReports = ["ordinary", "reviewed"].flatMap(mode => [
	"", "-plain-false", "-plain-true", "-unanchored", "-gc", "-mutants"
	, "-owned-first", "-copied-first", "-plain-package"
	, "-consuming-package", "-unanchored-package"
].map(suffix => `build/owned-javascript-receivers/${mode}${suffix}.json`))
	.concat("build/owned-javascript-receiver-packaging/report.json");

/**
 * Require the exact non-skipped gate, reports, tools and strict summary result.
 *
 * @param workflow - Consumer workflow source.
 * @param manifest - Public scripts executed by the workflow.
 */
export const assertOwnedJavaScriptReceiverCi = (workflow, manifest) => {
	assert.equal(manifest.scripts["test:owned-javascript-receivers"], ownedJavaScriptReceiverScript);
	const job = workflow.split("  owned-javascript-receivers:\n")[1]?.split("  node-consumers:\n")[0];
	assert.ok(job); assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 150$/mu);
	assert.match(job, /sudo apt-get install -y [^\n]*\bripgrep\b/u);
	assert.match(job, /npx playwright install --with-deps chromium firefox webkit/u);
	assert.match(job, /bash scripts\/bootstrap-toolchains\.sh/u);
	assert.match(job, /bash scripts\/build-lean-link-spike\.sh/u);
	const step = job.split("      - name: Verify JavaScript receiver packages\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	const lines = step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, "");
	assert.equal(lines, ["set -euo pipefail", "source scripts/env.sh"
		, "npm run test:owned-javascript-receivers 2>&1 | tee build/owned-javascript-receivers.log"
		, ...["tests 28", "pass 28", "fail 0", "cancelled 0", "skipped 0"].map(line => `rg '^# ${line}$' build/owned-javascript-receivers.log`)
		, ...ownedJavaScriptReceiverReports.map(path => "test -s " + path)].join("\n"));
	const upload = job.split("      - name: Preserve JavaScript receiver acceptance\n")[1];
	assert.match(upload, /^ {8}if: always\(\)$/mu);
	for(const path of ["build/owned-javascript-receivers/", "build/owned-javascript-receiver-packaging/", "build/owned-javascript-receivers.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary, /^ {6}- owned-javascript-receivers$/mu);
	assert.ok(summary.includes("        if: needs.owned-javascript-receivers.result != 'success'\n        run: exit 1\n"));
	return { tests: 28, testFiles: 9, reports: 23, failurePropagated: true };
};
