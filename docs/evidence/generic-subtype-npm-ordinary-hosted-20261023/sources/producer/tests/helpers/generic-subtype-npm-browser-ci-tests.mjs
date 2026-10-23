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
		"route: [ordinary, reviewed]"
		, "LEAN_BRIDGE_GENERIC_SUBTYPE_NPM_BROWSER_TEST: \"1\""
		, "LEAN_BRIDGE_GENERIC_SUBTYPE_ROUTES: ${{ matrix.route }}"
		, "LEAN_BRIDGE_TYPE_CORPUS_BROWSERS: chromium,firefox,webkit"
		, "node --test --test-concurrency=1 tests/generic-subtype-npm-browser.test.mjs"
		, "test -s build/generic-subtype-npm-browser/${{ matrix.route }}.json"
		, "if-no-files-found: error"
		, "if: always() && steps.acceptance.outcome != 'success'"
	]) assert.ok(workflow.includes(text), text);
	assert.doesNotMatch(workflow, /continue-on-error/u);
	assert.ok(workflow.indexOf("Build the locked component engine") < workflow.indexOf("id: acceptance"));
	assert.ok(workflow.indexOf("Build the pinned shared Wasm runtime") < workflow.indexOf("id: acceptance"));
});
