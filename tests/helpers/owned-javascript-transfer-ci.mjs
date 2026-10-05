/**
 * Enforce the consuming JS gate and retain its private and installed reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedJavaScriptWasmCi } from "./owned-javascript-wasm-ci.mjs";

export const ownedJavaScriptTransferScript = "LEAN_BRIDGE_OWNED_JS_TRANSFER_TEST=1 node --test --test-concurrency=1 tests/owned-javascript-transfers.test.mjs tests/owned-javascript-transfer-packaging.test.mjs";
export const ownedJavaScriptTransferReports = ["ordinary", "reviewed"].map(mode => `build/owned-javascript-transfers/${mode}.json`)
	.concat("build/owned-javascript-transfer-packaging/report.json");

/**
 * Require execution, zero skipped tests, uploaded reports and failure propagation.
 *
 * @param workflow - Complete consumer workflow.
 * @param manifest - Package scripts executed by that workflow.
 */
export const assertOwnedJavaScriptTransferCi = (workflow, manifest) => {
	assertOwnedJavaScriptWasmCi(workflow);
	assert.equal(manifest.scripts["test:owned-javascript-transfers"], ownedJavaScriptTransferScript);
	const job = workflow.split("  owned-javascript-wasm:\n")[1]?.split("  node-consumers:\n")[0];
	const step = job?.split("      - name: Verify consuming JavaScript input ownership\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	const lines = step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, "");
	assert.equal(lines, ["set -euo pipefail", "source scripts/env.sh"
		, "npm run test:owned-javascript-transfers 2>&1 | tee build/owned-javascript-wasm/transfers.log"
		, "rg '^# fail 0$' build/owned-javascript-wasm/transfers.log"
		, "rg '^# skipped 0$' build/owned-javascript-wasm/transfers.log"
		, ...ownedJavaScriptTransferReports.map(path => "test -s " + path)].join("\n"));
	const upload = job.split("      - name: Preserve owned JavaScript and runtime execution logs\n")[1];
	for(const path of [...ownedJavaScriptTransferReports, "build/owned-javascript-wasm/transfers.log"])
		assert.ok(upload?.includes("            " + path + "\n"), path);
	return { reports: 3, testFiles: 2, failurePropagated: true };
};
