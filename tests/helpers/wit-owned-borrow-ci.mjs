/**
 * Require execution of original-owner WIT borrows and installed archives.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedWitTransferCi } from "./wit-owned-transfer-ci.mjs";

export const ownedWitBorrowScript = "LEAN_BRIDGE_WIT_OWNED_BORROW_TEST=1 node --test --test-concurrency=1 tests/wit-owned-borrows.test.mjs tests/wit-owned-borrow-packaging.test.mjs";
export const ownedWitBorrowReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-borrow-only", "-package"].map(suffix => `build/owned-wit-borrows/${mode}${suffix}.json`));

/**
 * Preserve older gates and reject skipped or incomplete borrowed-result runs.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Actual package script definitions.
 */
export const assertOwnedWitBorrowCi = (workflow, manifest) => {
	assertOwnedWitTransferCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-wit-borrows"], ownedWitBorrowScript);
	const job = workflow.split("  wasi-consumer:\n")[1]?.split("  docker-engine:\n")[0];
	const step = job?.split("      - name: Verify owner-anchored WIT results\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}id: owned_wit_borrows$/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	assert.equal(step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, ""), [
		"set -euo pipefail"
		, 'export LEAN_BRIDGE_WASMTIME_C_API="$PWD/build/wasmtime-c-api"'
		, "source scripts/env.sh"
		, "npm run test:owned-wit-borrows 2>&1 | tee build/wit-owned-borrows.log"
		, ...["tests 8", "pass 8", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/wit-owned-borrows.log`)
		, ...ownedWitBorrowReports.map(path => "test -s " + path)
	].join("\n"));
	const upload = job.split("      - name: Preserve owner-anchored WIT execution\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of [...ownedWitBorrowReports, "build/wit-owned-borrows.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const observations = job.split("      - name: Record WIT and WASI observations\n")[1];
	for(const name of ["test_result", "executed"])
		assert.match(observations?.split(`          ${name}=`)[1]?.split("\n")[0] ?? "", /steps\.owned_wit_borrows\.outcome == 'success'/u);
	assert.match(observations ?? "", / && npm run test:owned-wit-borrows/u);
	const enforce = job.split("      - name: Enforce WIT and WASI support\n")[1];
	assert.match(enforce ?? "", /steps\.owned_wit_borrows\.outcome != 'success'/u);
};
