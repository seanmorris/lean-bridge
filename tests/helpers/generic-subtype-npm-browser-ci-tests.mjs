/**
 * Recurring hosted gate for installed generic Subtype npm/browser packages.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("CI installs each generic Subtype author route in Node and all browser realms", async () => {
	const workflow = await readFile(".github/workflows/generic-subtype-npm-browser.yml", "utf8");
	for(const text of [
		"route: ${{ fromJSON((inputs.optional_parameters || inputs.direct_proof_erasure || inputs.host_null) && '[\"reviewed\"]' || '[\"ordinary\",\"reviewed\"]') }}"
		, "- name: Check out the focused package revision"
		, "if: ${{ inputs.optional_parameters || inputs.direct_proof_erasure || inputs.host_null }}"
		, "fetch-depth: 1"
		, "!/docs/evidence/"
		, "sparse-checkout-cone-mode: false"
		, "- name: Check out the exact revision and evidence history"
		, "if: ${{ !inputs.optional_parameters && !inputs.direct_proof_erasure && !inputs.host_null }}"
		, "LEAN_BRIDGE_GENERIC_SUBTYPE_NPM_BROWSER_TEST: \"1\""
		, "LEAN_BRIDGE_GENERIC_SUBTYPE_ROUTES: ${{ matrix.route }}"
		, "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit"
		, "node --test --test-concurrency=1 tests/generic-subtype-npm-browser.test.mjs"
		, "test -s build/generic-subtype-npm-browser/${{ matrix.route }}.json"
		, "if-no-files-found: error"
		, "if: ${{ always() && !inputs.optional_parameters && !inputs.direct_proof_erasure && !inputs.host_null && steps.acceptance.outcome != 'success' }}"
	]) assert.ok(workflow.includes(text), text);
	assert.equal(workflow.match(/^ {10}fetch-depth: 0$/gmu)?.length, 1);
	assert.equal(workflow.match(/^ {8}continue-on-error: true$/gmu)?.length, 3);
	assert.match(workflow
		, /id: optional_parameters\n {8}if: inputs\.optional_parameters && matrix\.route == 'reviewed'\n {8}continue-on-error: true/u);
	assert.match(workflow
		, /id: direct_proof_erasure\n {8}if: inputs\.direct_proof_erasure && matrix\.route == 'reviewed'\n {8}continue-on-error: true/u);
	assert.match(workflow
		, /id: host_null\n {8}if: inputs\.host_null && matrix\.route == 'reviewed'\n {8}continue-on-error: true/u);
	assert.ok(workflow.indexOf("Build the locked component engine") < workflow.indexOf("id: acceptance"));
	assert.ok(workflow.indexOf("Build the pinned shared Wasm runtime") < workflow.indexOf("id: acceptance"));
});
