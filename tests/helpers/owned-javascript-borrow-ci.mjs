/**
 * Require the complete borrowed-result gate and every execution report in CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedJavaScriptTransferCi } from "./owned-javascript-transfer-ci.mjs";

export const ownedJavaScriptBorrowScript = "LEAN_BRIDGE_OWNED_JS_BORROW_TEST=1 node --test --test-concurrency=1 tests/owned-javascript-borrows.test.mjs tests/owned-javascript-borrow-package.test.mjs tests/owned-wasm-borrow-registry.test.mjs tests/owned-javascript-borrow-mutants.test.mjs tests/owned-javascript-borrow-coexistence.test.mjs tests/owned-javascript-borrow-packaging.test.mjs";
export const ownedJavaScriptBorrowReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-borrow-only", "-mutants", "-owned-first", "-copied-first"].map(suffix => `build/owned-javascript-borrows/${mode}${suffix}.json`))
	.concat("build/owned-javascript-borrow-packaging/report.json");

/**
 * Verify exact execution and failure propagation without claiming a CI run passed.
 *
 * @param workflow - Full consumer workflow source.
 * @param manifest - Scripts that the workflow executes.
 */
export const assertOwnedJavaScriptBorrowCi = (workflow, manifest) => {
	assertOwnedJavaScriptTransferCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-javascript-borrows"], ownedJavaScriptBorrowScript);
	const job = workflow.split("  owned-javascript-wasm:\n")[1]?.split("  node-consumers:\n")[0];
	const step = job?.split("      - name: Verify owner-anchored JavaScript results\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	const run = step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, "");
	assert.equal(run, ["set -euo pipefail", "source scripts/env.sh"
		, "npm run test:owned-javascript-borrows 2>&1 | tee build/owned-javascript-wasm/borrows.log"
		, "rg '^# tests 25$' build/owned-javascript-wasm/borrows.log"
		, "rg '^# fail 0$' build/owned-javascript-wasm/borrows.log"
		, "rg '^# cancelled 0$' build/owned-javascript-wasm/borrows.log"
		, "rg '^# skipped 0$' build/owned-javascript-wasm/borrows.log"
		, ...ownedJavaScriptBorrowReports.map(path => "test -s " + path)].join("\n"));
	const upload = job.split("      - name: Preserve owned JavaScript and runtime execution logs\n")[1];
	for(const path of [...ownedJavaScriptBorrowReports, "build/owned-javascript-wasm/borrows.log"])
		assert.ok(upload?.includes("            " + path + "\n"), path);
	return { reports: 11, tests: 25, testFiles: 6, failurePropagated: true };
};
