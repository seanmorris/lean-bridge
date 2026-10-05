/**
 * Require Python receiver packages, typing and optional-capability regressions.
 *
 * @file
 */
import assert from "node:assert/strict";
import { assertOwnedRustReceiverCi } from "./owned-rust-receiver-ci.mjs";
import { assertOwnedPythonBorrowCi } from "./owned-python-borrow-evidence.mjs";

export const ownedPythonReceiverScript = "LEAN_BRIDGE_OWNED_PYTHON_RECEIVER_TEST=1 node --test --test-concurrency=1 tests/owned-python-receivers.test.mjs tests/owned-python-receiver-packaging.test.mjs tests/owned-python-receiver-plain.test.mjs";
export const ownedPythonReceiverReports = [
	...["ordinary", "reviewed"].flatMap(mode =>
		["", "-package", "-plain", "-consuming"].map(suffix => `build/owned-python-receivers/${mode}${suffix}.json`))
	, "build/owned-python-receivers/typing.json"
];

/**
 * Keep every enabled test, source path and report in downstream validation.
 *
 * @param workflow - Complete downstream workflow source.
 * @param manifest - Actual package scripts.
 */
export const assertOwnedPythonReceiverCi = (workflow, manifest) => {
	assertOwnedRustReceiverCi(workflow, manifest); assertOwnedPythonBorrowCi(workflow, manifest);
	assert.equal(manifest.scripts["test:owned-python-receivers"], ownedPythonReceiverScript);
	const step = workflow.split("        id: type_corpus_python\n")[1]?.split("      - name: ")[0];
	assert.ok(step); assert.match(step, /^ {8}if: matrix\.profile == 'python'$/mu);
	for(const line of [
		"npm run test:owned-python-receivers > build/owned-python-receivers.log 2>&1"
		, "cat build/owned-python-receivers.log"
		, ...["tests 11", "pass 11", "fail 0", "cancelled 0", "skipped 0"].map(value => `rg '^# ${value}$' build/owned-python-receivers.log`)
		, ...ownedPythonReceiverReports.map(path => "test -s " + path)
	]) assert.ok(step.split("\n").includes("          " + line), line);
	const upload = workflow.split("      - name: Upload the real-Lean type corpus report\n")[1]?.split("      - name: ")[0];
	assert.match(upload ?? "", /^ {10}if-no-files-found: error$/mu);
	for(const path of ["build/owned-python-receivers/", "build/owned-python-receivers.log"])
		assert.ok(upload.split("\n").includes("            " + path));
	assert.ok(workflow.includes('consumer_command="$consumer_command && npm run test:owned-python-receivers"'));
};
