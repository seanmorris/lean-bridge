/**
 * Require complete Ruby receiver acceptance and retain every installed report.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedPythonReceiverCi } from "./owned-python-receiver-ci.mjs";
import { assertOwnedRubyBorrowCi } from "./owned-ruby-borrow-evidence.mjs";

export const ownedRubyReceiverScript = "LEAN_BRIDGE_OWNED_RUBY_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-ruby-receivers.test.mjs tests/owned-ruby-receiver-packaging.test.mjs tests/owned-ruby-receiver-plain.test.mjs";
export const ownedRubyReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-package", "-plain", "-consuming"].map(suffix => `build/owned-ruby-receivers/${mode}${suffix}.json`));

/**
 * Keep both source paths, all optional-capability cases and package verification.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Actual package scripts.
 */
export const assertOwnedRubyReceiverCi = (workflow, manifest) => {
	assertOwnedPythonReceiverCi(workflow, manifest); assertOwnedRubyBorrowCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-ruby-receivers"], ownedRubyReceiverScript);
	const steps = workflow.split("      - name: ").filter(section => section.split("\n").includes("        id: type_corpus_ruby"));
	assert.equal(steps.length, 1); const [step] = steps;
	assert.match(step, /^ {8}if: matrix\.profile == 'ruby'$/mu);
	for(const line of [
		"npm run test:owned-ruby-receivers > build/owned-ruby-receivers.log 2>&1"
		, "cat build/owned-ruby-receivers.log"
		, ...["tests 10", "pass 10", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-ruby-receivers.log`)
		, ...ownedRubyReceiverReports.map(path => "test -s " + path)
	]) assert.ok(step.split("\n").includes("          " + line), line);
	const upload = workflow.split("      - name: Upload the Ruby real-Lean type corpus report\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-ruby-receivers/", "build/owned-ruby-receivers.log"])
		assert.ok(upload.split("\n").includes("            " + path));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-ruby-receivers"'));
};
