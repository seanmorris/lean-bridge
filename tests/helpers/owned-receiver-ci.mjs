/**
 * Require receiver runtime checks and source-free installed C packages in CI.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedBorrowCi } from "./owned-borrow-evidence.mjs";

export const ownedReceiverScript = "LEAN_BRIDGE_OWNED_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-receiver-analysis.test.mjs tests/owned-receiver-packaging.test.mjs tests/owned-receiver-plain.test.mjs";
export const ownedReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-package", "-plain"].map(suffix => `build/owned-receivers/${mode}${suffix}.json`));

/**
 * Retain earlier gates and reject skipped runs or absent receiver artifacts.
 *
 * @param workflow - Downstream workflow source.
 * @param manifest - Actual npm manifest.
 */
export const assertOwnedReceiverCi = (workflow, manifest) => {
	assertOwnedBorrowCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-receivers"], ownedReceiverScript);
	const step = workflow.split("        id: type_corpus_c_family\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.match(step, /^ {8}if: matrix\.profile == 'c-family'$/mu);
	for(const line of [
		"npm run test:owned-receivers > build/owned-receivers.log 2>&1"
		, "cat build/owned-receivers.log"
		, ...["tests 8", "pass 8", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-receivers.log`)
		, ...ownedReceiverReports.map(path => "test -s " + path)
	]) assert.ok(step.split("\n").includes("          " + line), line);
	const upload = workflow.split("      - name: Upload installed C and C++ corpus observations\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-receivers/", "build/owned-receivers.log"])
		assert.ok(upload.split("\n").includes("            " + path));
};
