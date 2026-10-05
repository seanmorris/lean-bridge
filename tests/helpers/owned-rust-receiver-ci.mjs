/**
 * Require the complete Rust receiver gate without weakening predecessor checks.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedCppReceiverCi } from "./owned-cpp-receiver-ci.mjs";
import { assertOwnedRustBorrowCi } from "./owned-rust-borrow-evidence.mjs";

export const ownedRustReceiverScript = "LEAN_BRIDGE_OWNED_RUST_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-rust-receivers.test.mjs tests/owned-rust-receiver-packaging.test.mjs tests/owned-rust-receiver-plain.test.mjs";
export const ownedRustReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-package", "-plain", "-consuming"].map(suffix => `build/owned-rust-receivers/${mode}${suffix}.json`));

/**
 * Reject skipped runtime cases, missing package reports or lost uploads.
 *
 * @param workflow - Actual downstream workflow source.
 * @param manifest - Actual npm manifest.
 */
export const assertOwnedRustReceiverCi = (workflow, manifest) => {
	assertOwnedCppReceiverCi(workflow, manifest); assertOwnedRustBorrowCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-rust-receivers"], ownedRustReceiverScript);
	const step = workflow.split("        id: type_corpus_rust\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.match(step, /^ {8}if: matrix\.profile == 'rust'$/mu);
	for(const line of [
		"npm run test:owned-rust-receivers > build/owned-rust-receivers.log 2>&1"
		, "cat build/owned-rust-receivers.log"
		, ...["tests 10", "pass 10", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-rust-receivers.log`)
		, ...ownedRustReceiverReports.map(path => "test -s " + path)
	]) assert.ok(step.split("\n").includes("          " + line), line);
	const upload = workflow.split("      - name: Upload installed Rust corpus observations\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-rust-receivers/", "build/owned-rust-receivers.log"])
		assert.ok(upload.split("\n").includes("            " + path));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-rust-receivers"'));
};
