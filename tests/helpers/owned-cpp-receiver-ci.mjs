/**
 * Require compiled and installed C++ receiver checks in the downstream gate.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedReceiverCi } from "./owned-receiver-ci.mjs";

export const ownedCppReceiverScript = "LEAN_BRIDGE_OWNED_CPP_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-cpp-receivers.test.mjs tests/owned-cpp-receiver-packaging.test.mjs tests/owned-cpp-receiver-plain.test.mjs";
export const ownedCppReceiverReports = ["ordinary", "reviewed"].flatMap(mode =>
	["", "-package", "-plain", "-consuming"].map(suffix => `build/owned-cpp-receivers/${mode}${suffix}.json`));

/**
 * Keep the earlier C gate and reject skipped C++ tests or missing reports.
 *
 * @param workflow - Actual downstream workflow source.
 * @param manifest - Actual npm manifest.
 */
export const assertOwnedCppReceiverCi = (workflow, manifest) => {
	assertOwnedReceiverCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-cpp-receivers"], ownedCppReceiverScript);
	const step = workflow.split("        id: type_corpus_c_family\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.match(step, /^ {8}if: matrix\.profile == 'c-family'$/mu);
	for(const line of [
		"npm run test:owned-cpp-receivers > build/owned-cpp-receivers.log 2>&1"
		, "cat build/owned-cpp-receivers.log"
		, ...["tests 10", "pass 10", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-cpp-receivers.log`)
		, ...ownedCppReceiverReports.map(path => "test -s " + path)
	]) assert.ok(step.split("\n").includes("          " + line), line);
	const upload = workflow.split("      - name: Upload installed C and C++ corpus observations\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-cpp-receivers/", "build/owned-cpp-receivers.log"])
		assert.ok(upload.split("\n").includes("            " + path));
};
