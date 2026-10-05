/**
 * Require complete WIT receiver execution and retained installed-package reports.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedWitBorrowCi } from "./wit-owned-borrow-ci.mjs";

export const ownedWitReceiverScript = "LEAN_BRIDGE_WIT_OWNED_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/wit-owned-receiver-model.test.mjs tests/wit-owned-receivers.test.mjs tests/wit-owned-receiver-resource.test.mjs tests/wit-owned-receiver-packaging.test.mjs tests/wit-owned-receiver-resource-packaging.test.mjs";
export const ownedWitReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-plain", "-consuming", "-unanchored", "-package", "-plain-package", "-consuming-package", "-unanchored-package"]
		.map(suffix => `build/owned-wit-receivers/${mode}${suffix}.json`));

/**
 * Isolate the job so another consumer cannot satisfy a missing prerequisite.
 *
 * @param workflow - Complete downstream workflow.
 * @param manifest - Actual package script definitions.
 */
export const assertOwnedWitReceiverCi = (workflow, manifest) => {
	assertOwnedWitBorrowCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-wit-receivers"], ownedWitReceiverScript);
	const job = workflow.match(/^ {2}owned-wit-receivers:\n([^]*?)(?=^ {2}[a-z][a-z0-9-]*:\n)/mu)?.[0];
	assert.ok(job, "Missing WIT receiver job");
	assert.match(job, /^ {4}runs-on: ubuntu-24\.04$/mu);
	assert.match(job, /^ {4}timeout-minutes: 150$/mu);
	assert.doesNotMatch(job, /^ {4}(?:if|continue-on-error):/mu);
	for(const required of ["build-essential", "cmake", "pkg-config", "zstd"
		, "ripgrep", "libgmp-dev"
		, "bash scripts/bootstrap-toolchains.sh --lean-only"
		, "bash scripts/bootstrap-toolchains.sh --wasm-tools-only"
		, "nix build .#wasmtime-c-api --out-link build/wasmtime-c-api"
		, "npm ci --ignore-scripts"])
		assert.ok(job.includes(required), required);
	assert.match(job, /uses: cachix\/install-nix-action@v31/u);
	const step = job.split("      - name: Execute WIT receiver acceptance\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.doesNotMatch(step, /^ {8}(?:if|continue-on-error):/mu);
	assert.match(step, /^ {8}shell: bash$/mu);
	assert.equal(step.split("        run: |\n")[1]?.trim().replace(/^ {10}/gmu, ""), [
		"set -euo pipefail"
		, 'export LEAN_BRIDGE_WASMTIME_C_API="$PWD/build/wasmtime-c-api"'
		, "source scripts/env.sh"
		, "npm run test:owned-wit-receivers 2>&1 | tee build/wit-owned-receivers.log"
		, ...["tests 20", "pass 20", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/wit-owned-receivers.log`)
		, ...ownedWitReceiverReports.map(path => "test -s " + path)
	].join("\n"));
	const upload = job.split("      - name: Preserve WIT receiver execution\n")[1];
	assert.match(upload ?? "", /^ {8}if: always\(\)$/mu);
	assert.match(upload, /^ {8}uses: actions\/upload-artifact@v7$/mu);
	assert.match(upload, /^ {10}if-no-files-found: error$/mu);
	for(const path of [...ownedWitReceiverReports, "build/wit-owned-receivers.log"])
		assert.ok(upload.includes("            " + path + "\n"), path);
	const summary = workflow.split("  support-summary:\n")[1];
	assert.match(summary ?? "", /^ {6}- owned-wit-receivers$/mu);
	assert.ok(summary.includes("needs.owned-wit-receivers.result != 'success'"));
};
