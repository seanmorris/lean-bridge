/**
 * Enforce consuming WIT execution, failure propagation and retained reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedWitPackageCi } from "./wit-owned-package-evidence.mjs";

export const ownedWitTransferScript = "LEAN_BRIDGE_WIT_OWNED_TRANSFER_TEST=1 node --test --test-concurrency=1 tests/wit-owned-transfers.test.mjs tests/wit-owned-transfer-packaging.test.mjs";
export const ownedWitTransferReports = ["ordinary", "reviewed", "ordinary-package", "reviewed-package"]
	.map(name => `build/owned-wit-transfers/${name}.json`);

/**
 * Require the enabled runtime and installed gates, not only their unit tests.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Package scripts executed by that workflow.
 */
export const assertOwnedWitTransferCi = (workflow, manifest) => {
	assertOwnedWitPackageCi(workflow);
	assert.equal(manifest.scripts["test:owned-wit-transfers"], ownedWitTransferScript);
	const job = workflow.split("  wasi-consumer:\n")[1]?.split("  docker-engine:\n")[0];
	const step = job?.split("      - name: Verify consuming WIT input ownership\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}id: owned_wit_transfers$/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	assert.equal(step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, ""), [
		"set -euo pipefail"
		, 'export LEAN_BRIDGE_WASMTIME_C_API="$PWD/build/wasmtime-c-api"'
		, "source scripts/env.sh"
		, "npm run test:owned-wit-transfers 2>&1 | tee build/wit-owned-transfers.log"
		, ...["pass 5", "fail 0", "skipped 0"].map(value => `rg '^# ${value}$' build/wit-owned-transfers.log`)
		, ...ownedWitTransferReports.map(path => "test -s " + path)
	].join("\n"));
	const upload = job.split("      - name: Preserve consuming WIT execution\n")[1]?.split("      - name: ")[0];
	assert.ok(upload); assert.match(upload, /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	assert.doesNotMatch(upload, /^ {8}continue-on-error:/mu);
	for(const path of [...ownedWitTransferReports, "build/wit-owned-transfers.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const observations = job.split("      - name: Record WIT and WASI observations\n")[1];
	for(const name of ["test_result", "executed"])
		assert.match(observations?.split(`          ${name}=`)[1]?.split("\n")[0] ?? "", /steps\.owned_wit_transfers\.outcome == 'success'/u);
	const enforce = job.split("      - name: Enforce WIT and WASI support\n")[1];
	assert.match(enforce ?? "", /steps\.owned_wit_transfers\.outcome != 'success'/u);
};
